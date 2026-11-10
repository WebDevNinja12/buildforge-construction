import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildSchedule, type Frequency } from "@/lib/schedule";
import {
  installmentAllowedForStatus,
  installmentExtendsHoldHours,
  cancelRefundSummary,
  applyInstallmentAdminFee,
} from "@/lib/booking-rules";

export const dynamic = "force-dynamic";

function parseSchedule(json: string | null | undefined) {
  if (!json)
    return [] as Array<{
      sequence: number;
      amount: number;
      dueDate: string;
      status?: string;
      percentOfTotal?: number;
    }>;
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function loadPlan(id: string) {
  return prisma.reservation.findUnique({
    where: { id },
    include: {
      asset: true,
      payments: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

function totals(plan: NonNullable<Awaited<ReturnType<typeof loadPlan>>>) {
  const total = Number(plan.installmentTotal ?? plan.asset?.price ?? 0);
  const paid = Number(plan.installmentPaid ?? 0);
  return { total, paid, balance: Math.max(0, total - paid) };
}

function shapePlan(plan: NonNullable<Awaited<ReturnType<typeof loadPlan>>>) {
  const { total, paid, balance } = totals(plan);
  const installments = parseSchedule(plan.scheduleJson);
  const next = installments.find((i) => (i.status || "PENDING") === "PENDING");
  return {
    ...plan,
    totalAmount: total,
    amountPaid: paid,
    deposit: total * 0.4,
    paymentMethod: plan.paymentType || "UNSET",
    paymentFrequency: plan.installmentFrequency,
    planDeadline: plan.planDeadlineAt,
    installments: installments.map((i) => ({
      ...i,
      status: i.status || "PENDING",
    })),
    summary: {
      totalPrice: total,
      amountPaid: paid,
      balance,
      nextDueDate: next?.dueDate || plan.nextDueAt || null,
      nextAmount: next?.amount || null,
      planDeadline: plan.planDeadlineAt,
      frequency: plan.installmentFrequency,
      needsPaymentMethod: !plan.paymentType || plan.paymentType === "UNSET",
    },
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const plan = await loadPlan(id);
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "ADMIN" && plan.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(shapePlan(plan));
  } catch (e) {
    console.error("plans GET", e);
    return NextResponse.json(
      { error: "Failed to load plan", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const action = String(body.action || "");

    const plan = await loadPlan(id);
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "ADMIN" && plan.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { total, paid, balance } = totals(plan);
    const price = Number(plan.asset?.price ?? total ?? 0);
    const assetType = String(plan.asset?.type || "").toUpperCase();

    if (action === "SET_PAYMENT_METHOD") {
      const method = String(body.paymentMethod || "").toUpperCase();
      if (method !== "FULL" && method !== "INSTALLMENT") {
        return NextResponse.json({ error: "Choose FULL or INSTALLMENT" }, { status: 400 });
      }
      if (plan.paymentType && plan.paymentType !== "UNSET" && paid > 0) {
        return NextResponse.json({ error: "Payment method already set" }, { status: 400 });
      }

      if (method === "INSTALLMENT") {
        const gate = installmentAllowedForStatus(assetType, plan.status, paid, total || price);
        if (!gate.ok) {
          return NextResponse.json(
            {
              error: gate.reason || "Installment not available for this service",
              code: "INSTALLMENT_NOT_ALLOWED",
            },
            { status: 400 }
          );
        }
      }

      if (method === "FULL") {
        await prisma.reservation.update({
          where: { id },
          data: {
            paymentType: "FULL",
            installmentTotal: price,
            installmentFrequency: null,
            installmentCount: 1,
            scheduleJson: null,
            rulesAgreedAt: null,
          },
        });
        const updated = await loadPlan(id);
        return NextResponse.json({
          ok: true,
          paymentMethod: "FULL",
          message: "Full payment selected. Submit payment from your plan card.",
          plan: updated ? shapePlan(updated) : null,
        });
      }

      const frequency = (String(body.paymentFrequency || "MONTHLY").toUpperCase() ||
        "MONTHLY") as Frequency;
      let months = 6;
      try {
        const cat = await prisma.categoryDefault.findUnique({
          where: { category: plan.asset?.type || "HOUSE" },
        });
        if (cat?.installmentPlanMonths) months = cat.installmentPlanMonths;
      } catch {
        /* */
      }

      const fee = applyInstallmentAdminFee(price, assetType);
      const planTotal = fee.planTotal;
      const deadline = new Date(Date.now() + months * 30 * 24 * 3600 * 1000);
      const schedule = buildSchedule({
        totalAmount: planTotal,
        amountAlreadyPaid: 0,
        frequency,
        planDeadline: deadline,
      });
      const nextDue = schedule[0]?.dueDate ? new Date(schedule[0].dueDate) : null;

      const extendH = installmentExtendsHoldHours(assetType);
      let newExpires = plan.expiresAt ? new Date(plan.expiresAt) : null;
      if (extendH > 0) {
        const base = plan.expiresAt ? new Date(plan.expiresAt) : new Date();
        newExpires = new Date(base.getTime() + extendH * 60 * 60 * 1000);
      }

      await prisma.reservation.update({
        where: { id },
        data: {
          paymentType: "INSTALLMENT",
          installmentFrequency: frequency,
          installmentTotal: planTotal,
          installmentCount: schedule.length,
          planDeadlineAt: deadline,
          nextDueAt: nextDue,
          scheduleJson: JSON.stringify(
            schedule.map((s) => ({
              sequence: s.sequence,
              amount: s.amount,
              dueDate: s.dueDate instanceof Date ? s.dueDate.toISOString() : s.dueDate,
              status: "PENDING",
              percentOfTotal: s.percentOfTotal,
            }))
          ),
          rulesAgreedAt: new Date(),
          docsStatus: plan.docsStatus || "INCOMPLETE",
          ...(newExpires ? { expiresAt: newExpires } : {}),
        },
      });

      const updated = await loadPlan(id);
      const extendNote =
        extendH > 0
          ? ` Reservation hold extended by ${extendH} hours because installment was chosen within the reservation period.`
          : "";
      return NextResponse.json({
        ok: true,
        paymentMethod: "INSTALLMENT",
        redirectToDocs: true,
        holdExtendedHours: extendH,
        listPrice: fee.listPrice,
        planAdminFeePercent: fee.feePercent,
        planAdminFeeAmount: fee.feeAmount,
        planTotal: fee.planTotal,
        feeDisclosure: fee.disclosure,
        schedulePreview: schedule.map((s) => ({
          sequence: s.sequence,
          amount: s.amount,
          percentOfTotal: s.percentOfTotal,
        })),
        message:
          `Installment selected. First payment is 40% of the plan total, then 20% each until paid off. ${fee.disclosure} Upload all required documents now. After admin approval you can make the first installment payment.` +
          extendNote,
        plan: updated ? shapePlan(updated) : null,
      });
    }

    if (action === "CANCEL_QUOTE") {
      const summary = cancelRefundSummary(paid);
      return NextResponse.json({
        percent: summary.percent,
        deducted: summary.deducted,
        refundAmount: summary.refundAmount,
        message: summary.message,
      });
    }

    if (action === "CANCEL_CONFIRM") {
      if (total > 0 && paid >= total) {
        return NextResponse.json(
          { error: "Fully paid plans cannot be cancelled." },
          { status: 400 }
        );
      }
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelReason: String(body.reason || "Client confirmed").slice(0, 500),
          },
        });
        const other = await tx.reservation.findFirst({
          where: {
            assetId: plan.assetId,
            id: { not: id },
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        });
        if (!other) {
          await tx.asset.update({
            where: { id: plan.assetId },
            data: { status: "AVAILABLE" },
          });
        }
      });
      return NextResponse.json({ ok: true, message: "Reservation cancelled." });
    }

    if (
      action === "PAY_REMAINING" ||
      action === "EXTRA_PAYMENT" ||
      action === "PAY_INSTALLMENT" ||
      action === "PAY_NOW" ||
      action === "PAY_FULL"
    ) {
      if (!plan.paymentType || plan.paymentType === "UNSET") {
        return NextResponse.json(
          { error: "Choose Full or Installment payment first" },
          { status: 400 }
        );
      }

      if (plan.paymentType === "INSTALLMENT" && action !== "EXTRA_PAYMENT") {
        const docsStatus = String(plan.docsStatus || "INCOMPLETE").toUpperCase();
        const isFirstPayment = Number(plan.installmentPaid || 0) <= 0;
        const blocked =
          isFirstPayment &&
          docsStatus !== "APPROVED" &&
          ["INCOMPLETE", "UNDER_REVIEW", "PENDING", "ACTION_NEEDED", "REJECTED", ""].includes(
            docsStatus
          );

        if (blocked) {
          return NextResponse.json(
            {
              error:
                docsStatus === "UNDER_REVIEW" || docsStatus === "PENDING"
                  ? "Your documents are under review. Wait for admin approval before the first installment payment."
                  : docsStatus === "REJECTED" || docsStatus === "ACTION_NEEDED"
                    ? "Some documents were rejected. Update them and wait for approval before paying."
                    : "Upload all required installment documents and wait for admin approval before the first payment.",
              code: "DOCS_REQUIRED",
              docsStatus,
            },
            { status: 400 }
          );
        }
      }

      let amount =
        action === "PAY_REMAINING" || action === "PAY_FULL"
          ? balance || price
          : Number(body.amount || 0);

      if ((action === "PAY_INSTALLMENT" || action === "PAY_NOW") && !(amount > 0)) {
        if (plan.paymentType === "FULL") {
          amount = balance || price;
        } else {
          const schedule = parseSchedule(plan.scheduleJson);
          const next = schedule.find((i) => (i.status || "PENDING") === "PENDING");
          amount = Number(next?.amount || price * 0.4);
        }
      }

      if (!(amount > 0) || !Number.isFinite(amount)) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }

      if (balance > 0 && amount > balance) amount = balance;

      const type =
        action === "PAY_REMAINING" || action === "PAY_FULL"
          ? "PAY_REMAINING"
          : action === "EXTRA_PAYMENT"
            ? "EXTRA"
            : plan.paymentType === "FULL"
              ? "FULL"
              : "INSTALLMENT";

      const payment = await prisma.payment.create({
        data: {
          userId: plan.userId,
          amount,
          currency: "NGN",
          type,
          method: body.proofUrl ? "PROOF_UPLOAD" : "MANUAL",
          status: "PENDING",
          proofUrl: body.proofUrl ? String(body.proofUrl) : null,
          reservationId: id,
          referenceId: id,
        },
      });

      try {
        await prisma.notification.create({
          data: {
            userId: plan.userId,
            title: "Payment submitted",
            body: `Payment of ${amount} is pending admin approval.`,
            type: "PAYMENT",
          },
        });
      } catch {
        /* */
      }

      return NextResponse.json({
        ok: true,
        payment,
        message: "Payment submitted for admin approval",
      });
    }

    if (action === "SET_FREQUENCY") {
      const frequency = (String(body.frequency || "MONTHLY").toUpperCase() ||
        "MONTHLY") as Frequency;
      const deadline =
        plan.planDeadlineAt ||
        plan.expiresAt ||
        new Date(Date.now() + 180 * 24 * 3600 * 1000);
      const schedule = buildSchedule({
        totalAmount: total || price,
        amountAlreadyPaid: paid,
        frequency,
        planDeadline: new Date(deadline),
      });
      await prisma.reservation.update({
        where: { id },
        data: {
          installmentFrequency: frequency,
          scheduleJson: JSON.stringify(
            schedule.map((s) => ({
              sequence: s.sequence,
              amount: s.amount,
              dueDate: s.dueDate instanceof Date ? s.dueDate.toISOString() : s.dueDate,
              status: "PENDING",
              percentOfTotal: s.percentOfTotal,
            }))
          ),
          nextDueAt: schedule[0]?.dueDate ? new Date(schedule[0].dueDate) : null,
        },
      });
      const updated = await loadPlan(id);
      return NextResponse.json({ ok: true, plan: updated ? shapePlan(updated) : null });
    }

    return NextResponse.json({ error: `Unknown action: ${action || "(empty)"}` }, { status: 400 });
  } catch (e) {
    console.error("plans POST", e);
    return NextResponse.json(
      {
        error: "Plan update failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
