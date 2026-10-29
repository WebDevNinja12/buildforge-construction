import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cancelPercentForPlan, buildSchedule, parseFrequencies, type Frequency } from "@/lib/schedule";
import { getCategoryConfig } from "@/lib/maintenance";

async function loadPlan(id: string) {
  return prisma.reservation.findUnique({
    where: { id },
    include: {
      asset: true,
      installments: { orderBy: { sequence: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const plan = await loadPlan(id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.role !== "ADMIN" && plan.userId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const total = plan.totalAmount || plan.deposit;
  const paid = plan.amountPaid || 0;
  const balance = Math.max(0, total - paid);
  const next = plan.installments.find((i) => i.status === "PENDING");

  return NextResponse.json({
    ...plan,
    summary: {
      totalPrice: total,
      amountPaid: paid,
      balance,
      nextDueDate: next?.dueDate || null,
      nextAmount: next?.amount || null,
      planDeadline: plan.planDeadline,
      frequency: plan.paymentFrequency,
      overdue: next?.dueDate ? new Date(next.dueDate) < new Date() : false,
      needsPaymentMethod: plan.paymentMethod === "UNSET",
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const action = body.action as string;

  const plan = await loadPlan(id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.role !== "ADMIN" && plan.userId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const total = plan.totalAmount || plan.asset.price;
  const paid = plan.amountPaid || 0;
  const balance = Math.max(0, total - paid);
  const cfg = await getCategoryConfig(plan.asset.type);

  /** Choose payment after reserve */
  if (action === "SET_PAYMENT_METHOD") {
    const method = body.paymentMethod;
    if (method !== "FULL" && method !== "INSTALLMENT") {
      return NextResponse.json({ error: "Choose FULL or INSTALLMENT" }, { status: 400 });
    }
    if (plan.paymentMethod !== "UNSET" && plan.paymentMethod !== "PENDING") {
      return NextResponse.json({ error: "Payment method already set" }, { status: 400 });
    }

    if (method === "FULL") {
      await prisma.reservation.update({
        where: { id },
        data: {
          paymentMethod: "FULL",
          deposit: total,
          totalAmount: total,
        },
      });
      await prisma.payment.create({
        data: {
          userId: plan.userId,
          amount: total,
          type: "FULL",
          method: "PENDING",
          status: "PENDING",
          reservationId: id,
          referenceId: id,
        },
      });
      await prisma.notification.create({
        data: {
          userId: plan.userId,
          title: "Full payment selected",
          body: `Pay ${total} for "${plan.asset.title}" — upload proof or wait for admin instructions on Dashboard.`,
          type: "PAYMENT",
          link: "/dashboard",
        },
      });
      return NextResponse.json({ ok: true, paymentMethod: "FULL", message: "Full payment selected. Complete payment below." });
    }

    // INSTALLMENT
    if (!body.rulesAgreed) {
      return NextResponse.json({ error: "Agree to installment rules" }, { status: 400 });
    }
    const allowed = parseFrequencies(
      plan.asset.allowedFrequencies || (cfg as any).allowedFrequencies || '["MONTHLY"]'
    );
    const frequency = (body.paymentFrequency || allowed[0] || "MONTHLY") as Frequency;
    let planDeadline: Date;
    if (cfg.continuesAfterHold) {
      const months = plan.asset.installmentPlanMonths || cfg.installmentPlanMonths || 6;
      planDeadline = new Date();
      planDeadline.setMonth(planDeadline.getMonth() + months);
    } else {
      planDeadline = plan.expiresAt || new Date(Date.now() + 7 * 24 * 3600 * 1000);
    }
    const deposit = Math.round(total * 0.1 * 100) / 100;
    const schedule = buildSchedule({
      totalAmount: total,
      amountAlreadyPaid: 0,
      frequency,
      planDeadline,
    });

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id },
        data: {
          paymentMethod: "INSTALLMENT",
          paymentFrequency: frequency,
          deposit,
          totalAmount: total,
          planDeadline,
          rulesAgreedAt: new Date(),
        },
      });
      await tx.installment.deleteMany({ where: { reservationId: id } });
      for (const row of schedule) {
        await tx.installment.create({
          data: {
            reservationId: id,
            sequence: row.sequence,
            amount: row.amount,
            dueDate: row.dueDate,
            status: "PENDING",
          },
        });
      }
      await tx.payment.create({
        data: {
          userId: plan.userId,
          amount: deposit,
          type: "DEPOSIT",
          method: "PENDING",
          status: "PENDING",
          reservationId: id,
          referenceId: id,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      paymentMethod: "INSTALLMENT",
      frequency,
      message: "Installment plan created. Pay the deposit from Dashboard.",
    });
  }

  if (action === "CANCEL_QUOTE") {
    const pct = cancelPercentForPlan({
      amountPaid: paid,
      totalAmount: total,
      defaultPercent: cfg.cancelDeductionPercent ?? 10,
      beforeFirst: (cfg as any).cancelPercentBeforeFirst,
      afterHalf: (cfg as any).cancelPercentAfterHalf,
    });
    const deducted = Math.round(paid * (pct / 100) * 100) / 100;
    const refund = Math.max(0, Math.round((paid - deducted) * 100) / 100);
    return NextResponse.json({
      cancellationPercent: pct,
      amountPaid: paid,
      deductedAmount: deducted,
      refundAmount: refund,
      message: `If you cancel, ${pct}% ($${deducted}) is withheld. Estimated refund: $${refund}.`,
    });
  }

  if (action === "CANCEL_CONFIRM") {
    const pct = cancelPercentForPlan({
      amountPaid: paid,
      totalAmount: total,
      defaultPercent: cfg.cancelDeductionPercent ?? 10,
      beforeFirst: (cfg as any).cancelPercentBeforeFirst,
      afterHalf: (cfg as any).cancelPercentAfterHalf,
    });
    const deducted = Math.round(paid * (pct / 100) * 100) / 100;
    const refund = Math.max(0, Math.round((paid - deducted) * 100) / 100);

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelReason: body.reason || `Client cancel ${pct}% fee`,
          deductionPercent: pct,
          refundAmount: refund,
        },
      });
      if (refund > 0) {
        await tx.payment.create({
          data: {
            userId: plan.userId,
            amount: refund,
            type: "REFUND",
            method: "ADMIN_CONFIRMED",
            status: "PENDING",
            reservationId: id,
            referenceId: id,
          },
        });
      }
      await tx.asset.update({
        where: { id: plan.assetId },
        data: { status: "AVAILABLE" },
      });
      return r;
    });

    return NextResponse.json({
      ...updated,
      refundAmount: refund,
      message: "Cancellation submitted.",
    });
  }

  if (action === "PAY_REMAINING" || action === "EXTRA_PAYMENT" || action === "PAY_INSTALLMENT") {
    let amount =
      action === "PAY_REMAINING" ? balance : Number(body.amount || 0);
    if (action === "PAY_INSTALLMENT" && !amount) {
      const next = plan.installments.find((i) => i.status === "PENDING");
      amount = next?.amount || plan.deposit || 0;
    }
    if (!(amount > 0)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const type =
      action === "PAY_REMAINING"
        ? "PAY_REMAINING"
        : action === "EXTRA_PAYMENT"
          ? "EXTRA"
          : "INSTALLMENT";

    const payment = await prisma.payment.create({
      data: {
        userId: plan.userId,
        amount,
        type,
        method: body.proofUrl ? "PROOF_UPLOAD" : "PENDING",
        status: "PENDING",
        proofUrl: body.proofUrl || null,
        reservationId: id,
        referenceId: id,
        installmentId: body.installmentId || null,
      },
    });

    return NextResponse.json({
      payment,
      message: "Payment submitted for admin approval",
    });
  }

  if (action === "SET_FREQUENCY") {
    const frequency = body.frequency as Frequency;
    if (!frequency) return NextResponse.json({ error: "frequency required" }, { status: 400 });
    const deadline =
      plan.planDeadline || plan.expiresAt || new Date(Date.now() + 180 * 24 * 3600 * 1000);
    const schedule = buildSchedule({
      totalAmount: total,
      amountAlreadyPaid: paid,
      frequency,
      planDeadline: new Date(deadline),
    });
    await prisma.$transaction(async (tx) => {
      await tx.installment.deleteMany({ where: { reservationId: id, status: "PENDING" } });
      const paidCount = await tx.installment.count({
        where: { reservationId: id, status: "PAID" },
      });
      for (const row of schedule) {
        await tx.installment.create({
          data: {
            reservationId: id,
            sequence: paidCount + row.sequence,
            amount: row.amount,
            dueDate: row.dueDate,
            status: "PENDING",
          },
        });
      }
      await tx.reservation.update({
        where: { id },
        data: { paymentFrequency: frequency },
      });
    });
    return NextResponse.json({ ok: true, frequency, message: "Schedule regenerated" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
