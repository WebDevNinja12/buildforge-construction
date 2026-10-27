import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireApproved } from "@/lib/auth";
import { getExpiryHours, getCategoryConfig, runMaintenance } from "@/lib/maintenance";

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
    if (paymentMethod === "INSTALLMENT") {
      if (!rulesAgreed && !body.rulesAgreedAt) {
        return NextResponse.json({ error: "You must agree to installment rules" }, { status: 400 });
      }
      const required = (cfg.requiredDocs || []).filter((d: any) => d.required);
      for (const d of required) {
        const uploaded = (documents as any[]).find((x) => x.key === d.key && x.fileUrl);
        if (!uploaded) {
          return NextResponse.json(
            { error: `Missing required document: ${d.label || d.key}` },
            { status: 400 }
          );
        }
      }
    }

    const hours = await getExpiryHours(asset.type, asset.reservationHours);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const totalAmount = asset.price;
    const depositAmount = paymentMethod === "FULL" ? totalAmount : totalAmount * 0.1;

    let planDeadline: Date | null = null;
    if (paymentMethod === "INSTALLMENT" && cfg.continuesAfterHold) {
      const months = asset.installmentPlanMonths || cfg.installmentPlanMonths || 6;
      planDeadline = new Date();
      planDeadline.setMonth(planDeadline.getMonth() + months);
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
          expiresAt,
          planDeadline,
          rulesAgreedAt: paymentMethod === "INSTALLMENT" ? new Date() : null,
          deductionPercent: cfg.cancelDeductionPercent ?? null,
        },
        include: { asset: true },
      });

      // Installment schedule
      if (paymentMethod === "INSTALLMENT") {
        let count = asset.installmentCount || 4;
        let percents: number[] = [];
        try {
          percents = JSON.parse(asset.installmentPercents || "[]");
        } catch {
          percents = [];
        }
        if (percents.length !== count) {
          // first is deposit 10%, rest equal on balance
          percents = [10];
          const rest = (90 / (count - 1));
          for (let i = 1; i < count; i++) percents.push(rest);
        }
        for (let i = 0; i < count; i++) {
          const amount = Math.round((totalAmount * (percents[i] / 100)) * 100) / 100;
          let due: Date;
          if (cfg.continuesAfterHold && planDeadline) {
            due = new Date();
            due.setDate(due.getDate() + Math.round(((i + 1) / count) * (monthsDays(cfg.installmentPlanMonths || 6))));
          } else {
            // within reservation period
            due = new Date(Date.now() + ((i + 1) / count) * hours * 3600 * 1000);
          }
          await tx.installment.create({
            data: {
              reservationId: res.id,
              sequence: i + 1,
              amount,
              dueDate: due,
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
            ? `Full-payment hold on "${asset.title}" for ${hours} hours.`
            : `Installment hold on "${asset.title}". Pay first deposit within ${hours} hours.`,
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
            : `Installment started. Deposit due within ${hours} hours.`,
        expiryHours: hours,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }
}

function monthsDays(m: number) {
  return m * 30;
}
