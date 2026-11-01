import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildSchedule, type Frequency } from "@/lib/schedule";

export const dynamic = "force-dynamic";

function parseSchedule(json: string | null | undefined) {
  if (!json) return [] as Array<{ sequence: number; amount: number; dueDate: string; status?: string }>;
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

function totals(plan: Awaited<ReturnType<typeof loadPlan>>) {
  if (!plan) return { total: 0, paid: 0, balance: 0 };
  const total = plan.installmentTotal ?? plan.asset?.price ?? 0;
  const paid = plan.installmentPaid ?? 0;
  return { total, paid, balance: Math.max(0, total - paid) };
}

function shapePlan(plan: NonNullable<Awaited<ReturnType<typeof loadPlan>>>) {
  const { total, paid, balance } = totals(plan);
  const installments = parseSchedule(plan.scheduleJson);
  const next = installments.find((i) => (i.status || "PENDING") === "PENDING");
  return {
    ...plan,
    // aliases used by PlanCard UI
    totalAmount: total,
    amountPaid: paid,
    deposit: total * 0.1,
    paymentMethod: plan.paymentType || "UNSET",
    paymentFrequency: plan.installmentFrequency,
    planDeadline: plan.planDeadlineAt,
    installments: installments.map((i) => ({
      ...i,
      dueDate: i.dueDate,
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
    let body: any = {};
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

    // —— SET_PAYMENT_METHOD ——
    if (action === "SET_PAYMENT_METHOD") {
      const method = String(body.paymentMethod || "").toUpperCase();
      if (method !== "FULL" && method !== "INSTALLMENT") {
        return NextResponse.json({ error: "Choose FULL or INSTALLMENT" }, { status: 400 });
      }
      if (plan.paymentType && plan.paymentType !== "UNSET") {
        // allow switch only if still pending unpaid
        if (paid > 0) {
          return NextResponse.json({ error: "Payment method already set" }, { status: 400 });
        }
      }

      if (method === "FULL") {
        await prisma.reservation.update({
          where: { id },
          data: {
            paymentType: "FULL",
            installmentTotal: total || plan.asset.price,
            installmentFrequency: null,
            scheduleJson: null,
            rulesAgreedAt: null,
          },
        });
        return NextResponse.json({
          ok: true,
          paymentMethod: "FULL",
          message: "Full payment selected. Complete payment below.",
        });
      }

      // INSTALLMENT
      if (!body.rulesAgreed) {
        return NextResponse.json({ error: "Agree to installment rules" }, { status: 400 });
      }
      const frequency = (body.paymentFrequency || "MONTHLY") as Frequency;
      const months = plan.asset.installmentMonths || 6;
      const deadline = new Date(Date.now() + months * 30 * 24 * 3600 * 1000);
      const schedule = buildSchedule({
        totalAmount: total || plan.asset.price,
        amountAlreadyPaid: 0,
        frequency,
        planDeadline: deadline,
      });
      const nextDue = schedule[0]?.dueDate ? new Date(schedule[0].dueDate) : null;

      await prisma.reservation.update({
        where: { id },
        data: {
          paymentType: "INSTALLMENT",
          installmentFrequency: frequency,
          installmentTotal: total || plan.asset.price,
          installmentCount: schedule.length,
          planDeadlineAt: deadline,
          nextDueAt: nextDue,
          scheduleJson: JSON.stringify(
            schedule.map((s) => ({ ...s, status: "PENDING" }))
          ),
          rulesAgreedAt: new Date(),
          docsStatus: plan.docsStatus || "INCOMPLETE",
        },
      });

      return NextResponse.json({
        ok: true,
        paymentMethod: "INSTALLMENT",
        message:
          "Installment selected. Upload required documents, then pay the first deposit after approval.",
      });
    }

    // —— CANCEL ——
    if (action === "CANCEL_QUOTE") {
      const pct = 10; // simple default; category config can refine later
      const deducted = Math.round(((paid || total * 0.1) * pct) / 100);
      const refund = Math.max(0, paid - deducted);
      return NextResponse.json({
        percent: pct,
        deducted,
        refundAmount: refund,
        message: `Cancel may deduct ~${pct}%. Estimated refund: ${refund}.`,
      });
    }

    if (action === "CANCEL_CONFIRM") {
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelReason: body.reason || "Client confirmed",
          },
        });
        if (plan.asset.status === "RESERVED") {
          await tx.asset.update({
            where: { id: plan.assetId },
            data: { status: "AVAILABLE" },
          });
        }
      });
      return NextResponse.json({ ok: true, message: "Reservation cancelled." });
    }

    // —— PAYMENTS ——
    if (action === "PAY_REMAINING" || action === "EXTRA_PAYMENT" || action === "PAY_INSTALLMENT") {
      // Installment docs gate
      if (
        plan.paymentType === "INSTALLMENT" &&
        plan.docsStatus &&
        plan.docsStatus !== "APPROVED" &&
        action !== "EXTRA_PAYMENT"
      ) {
        // soft gate: allow if no docsStatus field usage yet
        if (["INCOMPLETE", "UNDER_REVIEW", "ACTION_NEEDED"].includes(plan.docsStatus)) {
          return NextResponse.json(
            {
              error:
                "Complete and get approval for installment documents before paying the deposit.",
            },
            { status: 400 }
          );
        }
      }

      let amount =
        action === "PAY_REMAINING" ? balance : Number(body.amount || 0);

      if (action === "PAY_INSTALLMENT" && !(amount > 0)) {
        const schedule = parseSchedule(plan.scheduleJson);
        const next = schedule.find((i) => (i.status || "PENDING") === "PENDING");
        amount = next?.amount || (total || plan.asset.price) * 0.1;
      }

      if (!(amount > 0)) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }

      const type =
        action === "PAY_REMAINING"
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
          type,
          method: body.proofUrl ? "PROOF_UPLOAD" : "PENDING",
          status: "PENDING",
          proofUrl: body.proofUrl || null,
          reservationId: id,
          referenceId: id,
        },
      });

      return NextResponse.json({
        payment,
        message: "Payment submitted for admin approval",
      });
    }

    if (action === "SET_FREQUENCY") {
      const frequency = (body.frequency || "MONTHLY") as Frequency;
      const deadline =
        plan.planDeadlineAt ||
        plan.expiresAt ||
        new Date(Date.now() + 180 * 24 * 3600 * 1000);
      const schedule = buildSchedule({
        totalAmount: total,
        amountAlreadyPaid: paid,
        frequency,
        planDeadline: new Date(deadline),
      });
      await prisma.reservation.update({
        where: { id },
        data: {
          installmentFrequency: frequency,
          scheduleJson: JSON.stringify(
            schedule.map((s) => ({ ...s, status: "PENDING" }))
          ),
          installmentCount: schedule.length,
          nextDueAt: schedule[0]?.dueDate ? new Date(schedule[0].dueDate) : null,
        },
      });
      return NextResponse.json({ ok: true, frequency, message: "Schedule regenerated" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("plans POST", e);
    return NextResponse.json(
      {
        error: "Payment action failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
