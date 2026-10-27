import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireApproved } from "@/lib/auth";
import { getExpiryHours, getCategoryConfig, runMaintenance } from "@/lib/maintenance";
import { buildSchedule, parseFrequencies, type Frequency } from "@/lib/schedule";

export async function GET() {
  try {
    await runMaintenance();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const where = session.role === "ADMIN" ? {} : { userId: session.id };
    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        asset: true,
        user: { select: { id: true, name: true, email: true } },
        installments: { orderBy: { sequence: "asc" } },
        installmentDocs: true,
        payments: { orderBy: { createdAt: "desc" }, take: 10 },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reservations);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await runMaintenance();
    let session;
    try {
      session = await requireApproved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      return NextResponse.json(
        { error: msg === "Account pending approval" ? msg : "Please login to reserve" },
        { status: msg === "Account pending approval" ? 403 : 401 }
      );
    }

    const body = await req.json();
    const {
      assetId,
      notes,
      confirmed,
      paymentMethod = "FULL",
      documents = [],
      rulesAgreed,
      paymentFrequency,
    } = body;

    if (!assetId) return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    if (!confirmed) {
      return NextResponse.json({ error: "Please confirm booking details" }, { status: 400 });
    }
    if (!["FULL", "INSTALLMENT"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== "AVAILABLE" || asset.active === false) {
      return NextResponse.json({ error: "Asset not available" }, { status: 400 });
    }

    const cfg = await getCategoryConfig(asset.type);
    const allowed = parseFrequencies(
      asset.allowedFrequencies || (cfg as any).allowedFrequencies || '["MONTHLY"]'
    );
    let frequency: Frequency | null = null;
    if (paymentMethod === "INSTALLMENT") {
      frequency = (paymentFrequency || allowed[0] || "MONTHLY") as Frequency;
      if (!allowed.includes(frequency)) {
        return NextResponse.json(
          { error: `Frequency not allowed. Choose: ${allowed.join(", ")}` },
          { status: 400 }
        );
      }
      if (!rulesAgreed && !body.rulesAgreedAt) {
        return NextResponse.json({ error: "You must agree to installment rules" }, { status: 400 });
      }
    }

    const hours = await getExpiryHours(asset.type, asset.reservationHours);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const totalAmount = asset.price;
    const depositAmount = paymentMethod === "FULL" ? totalAmount : totalAmount * 0.1;

    let planDeadline: Date | null = null;
    if (paymentMethod === "INSTALLMENT") {
      if (cfg.continuesAfterHold) {
        const months = asset.installmentPlanMonths || cfg.installmentPlanMonths || 6;
        planDeadline = new Date();
        planDeadline.setMonth(planDeadline.getMonth() + months);
      } else {
        planDeadline = expiresAt;
      }
    }

    const reservation = await prisma.$transaction(async (tx) => {
      await tx.asset.update({ where: { id: assetId }, data: { status: "RESERVED" } });

      const res = await tx.reservation.create({
        data: {
          userId: session.id,
          assetId,
          deposit: depositAmount,
          totalAmount,
          amountPaid: 0,
          notes: notes || null,
          status: "PENDING",
          paymentMethod,
          paymentFrequency: frequency,
          expiresAt,
          planDeadline,
          rulesAgreedAt: paymentMethod === "INSTALLMENT" ? new Date() : null,
          deductionPercent: cfg.cancelDeductionPercent ?? null,
        },
        include: { asset: true },
      });

      if (paymentMethod === "INSTALLMENT" && frequency && planDeadline) {
        const schedule = buildSchedule({
          totalAmount,
          amountAlreadyPaid: 0,
          frequency,
          planDeadline,
        });
        for (const row of schedule) {
          await tx.installment.create({
            data: {
              reservationId: res.id,
              sequence: row.sequence,
              amount: row.amount,
              dueDate: row.dueDate,
              status: "PENDING",
            },
          });
        }
        for (const doc of documents as any[]) {
          if (!doc.fileUrl) continue;
          await tx.installmentDocument.create({
            data: {
              reservationId: res.id,
              userId: session.id,
              docKey: doc.key,
              label: doc.label || doc.key,
              fileUrl: doc.fileUrl,
              fileName: doc.fileName || null,
              status: "PENDING",
            },
          });
        }
      }

      return res;
    });

    await prisma.payment.create({
      data: {
        userId: session.id,
        amount: depositAmount,
        type: paymentMethod === "FULL" ? "FULL" : "DEPOSIT",
        method: "PENDING",
        status: "PENDING",
        reservationId: reservation.id,
        referenceId: reservation.id,
      },
    });

    await prisma.notification.create({
      data: {
        userId: session.id,
        title: "Reservation created",
        body:
          paymentMethod === "FULL"
            ? `Full-payment hold on "${asset.title}".`
            : `Installment plan (${frequency}) started for "${asset.title}".`,
        type: "RESERVATION",
        link: "/dashboard",
      },
    });

    return NextResponse.json(
      {
        ...reservation,
        message:
          paymentMethod === "FULL"
            ? `Full payment hold for ${hours} hours.`
            : `Installment (${frequency}) created. Deposit due within ${hours} hours.`,
        expiryHours: hours,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }
}
