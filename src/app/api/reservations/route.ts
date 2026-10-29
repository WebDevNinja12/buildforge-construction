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

/**
 * Reserve first (no payment method required).
 * Payment method is chosen later on the dashboard.
 */
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
      // Optional — if omitted, client chooses on dashboard
      paymentMethod,
      documents = [],
      rulesAgreed,
      paymentFrequency,
    } = body;

    if (!assetId) return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    if (!confirmed) {
      return NextResponse.json({ error: "Please confirm after reviewing details" }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== "AVAILABLE" || asset.active === false) {
      return NextResponse.json({ error: "Asset not available" }, { status: 400 });
    }

    const cfg = await getCategoryConfig(asset.type);
    const hours = await getExpiryHours(asset.type, asset.reservationHours);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const totalAmount = asset.price;

    // Reserve-only path
    const method =
      paymentMethod === "FULL" || paymentMethod === "INSTALLMENT"
        ? paymentMethod
        : "UNSET";

    let frequency: Frequency | null = null;
    let planDeadline: Date | null = null;
    let depositAmount = 0;

    if (method === "INSTALLMENT") {
      const allowed = parseFrequencies(
        asset.allowedFrequencies || (cfg as any).allowedFrequencies || '["MONTHLY"]'
      );
      frequency = (paymentFrequency || allowed[0] || "MONTHLY") as Frequency;
      if (!rulesAgreed) {
        return NextResponse.json({ error: "Agree to installment rules" }, { status: 400 });
      }
      depositAmount = totalAmount * 0.1;
      if (cfg.continuesAfterHold) {
        const months = asset.installmentPlanMonths || cfg.installmentPlanMonths || 6;
        planDeadline = new Date();
        planDeadline.setMonth(planDeadline.getMonth() + months);
      } else {
        planDeadline = expiresAt;
      }
    } else if (method === "FULL") {
      depositAmount = totalAmount;
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
          paymentMethod: method,
          paymentFrequency: frequency,
          expiresAt,
          planDeadline,
          rulesAgreedAt: method === "INSTALLMENT" ? new Date() : null,
          deductionPercent: cfg.cancelDeductionPercent ?? null,
        },
        include: { asset: true },
      });

      if (method === "INSTALLMENT" && frequency && planDeadline) {
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

    await prisma.notification.create({
      data: {
        userId: session.id,
        title: "Reservation created",
        body:
          method === "UNSET"
            ? `"${asset.title}" is reserved. Open your dashboard to choose payment (full or installment) before the hold expires.`
            : `Reservation for "${asset.title}" created (${method}).`,
        type: "RESERVATION",
        link: "/dashboard",
      },
    });

    return NextResponse.json(
      {
        ...reservation,
        message:
          method === "UNSET"
            ? `Reserved for ${hours} hours. Go to Dashboard to choose payment and complete payment.`
            : `Reservation created. Complete payment from Dashboard.`,
        expiryHours: hours,
        nextStep: "/dashboard",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }
}
