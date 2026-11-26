import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { healSchema } from "@/lib/schema-heal";
import { buildSchedule, type Frequency } from "@/lib/schedule";
import {
  applyInstallmentAdminFee,
  cancelRefundSummary,
  installmentExtendsHoldHours,
  INSTALLMENT_HOLD_EXTENSION_HOURS,
} from "@/lib/booking-rules";

export const dynamic = "force-dynamic";

async function loadRental(id: string) {
  return prisma.toolRental.findUnique({
    where: { id },
    include: {
      tool: true,
      payments: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

function paidSum(rental: NonNullable<Awaited<ReturnType<typeof loadRental>>>) {
  const fromField = Number((rental as any).installmentPaid || 0);
  const fromPayments = (rental.payments || [])
    .filter((p) => String(p.status).toUpperCase() === "APPROVED")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(fromField, fromPayments);
}

function parseSchedule(json: string | null | undefined) {
  if (!json) return [] as Array<{ sequence: number; amount: number; dueDate: string; status?: string }>;
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const rental = await loadRental(id);
    if (!rental) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "ADMIN" && rental.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const total = Number(rental.total || 0);
    const paid = paidSum(rental);
    return NextResponse.json({
      ...rental,
      amountPaid: paid,
      balance: Math.max(0, total - paid),
      paymentMethod: (rental as any).paymentType || "UNSET",
      installments: parseSchedule((rental as any).scheduleJson),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to load rental", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await healSchema().catch(() => null);
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toUpperCase();

    const rental = await loadRental(id);
    if (!rental) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "ADMIN" && rental.userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const total = Number(rental.total || 0);
    const paid = paidSum(rental);
    const balance = Math.max(0, total - paid);
    const status = String(rental.status || "").toUpperCase();

    if (
      ["CANCELLED", "EXPIRED", "REFUNDED", "RETURNED"].includes(status) &&
      action !== "CANCEL_QUOTE" &&
      action !== "RETURN_COMPLETE"
    ) {
      return NextResponse.json({ error: "This tool rental is closed" }, { status: 400 });
    }

    if (action === "SET_PAYMENT_METHOD") {
      const method = String(body.paymentMethod || "").toUpperCase();
      if (method !== "FULL" && method !== "INSTALLMENT") {
        return NextResponse.json({ error: "Choose FULL or INSTALLMENT" }, { status: 400 });
      }
      if (paid > 0 && (rental as any).paymentType && (rental as any).paymentType !== "UNSET") {
        return NextResponse.json({ error: "Payment method already set" }, { status: 400 });
      }

      if (method === "FULL") {
        await prisma.toolRental.update({
          where: { id },
          data: {
            paymentType: "FULL",
            installmentFrequency: null,
            scheduleJson: null,
          } as any,
        });
        return NextResponse.json({
          ok: true,
          paymentMethod: "FULL",
          message: "Full payment selected (bank transfer). Open transfer details to pay.",
        });
      }

      const fee = applyInstallmentAdminFee(total, "TOOLS");
      const planTotal = fee.planTotal;
      const frequency = (String(body.paymentFrequency || "MONTHLY").toUpperCase() ||
        "MONTHLY") as Frequency;
      const deadline = new Date(Date.now() + 180 * 24 * 3600 * 1000);
      const schedule = buildSchedule({
        totalAmount: planTotal,
        amountAlreadyPaid: 0,
        frequency,
        planDeadline: deadline,
      });

      const extendH = installmentExtendsHoldHours("TOOLS") || INSTALLMENT_HOLD_EXTENSION_HOURS;
      let expiresAt = rental.expiresAt ? new Date(rental.expiresAt) : new Date();
      expiresAt = new Date(expiresAt.getTime() + extendH * 60 * 60 * 1000);

      await prisma.toolRental.update({
        where: { id },
        data: {
          paymentType: "INSTALLMENT",
          installmentFrequency: frequency,
          total: planTotal,
          scheduleJson: JSON.stringify(
            schedule.map((s) => ({
              sequence: s.sequence,
              amount: s.amount,
              dueDate: s.dueDate instanceof Date ? s.dueDate.toISOString() : s.dueDate,
              status: "PENDING",
              percentOfTotal: s.percentOfTotal,
            }))
          ),
          expiresAt,
        } as any,
      });

      return NextResponse.json({
        ok: true,
        paymentMethod: "INSTALLMENT",
        planTotal,
        feeDisclosure: fee.disclosure,
        message: `Installment selected (bank transfer). ${fee.disclosure} Hold extended by ${extendH}h.`,
      });
    }

    if (action === "CANCEL_QUOTE") {
      return NextResponse.json(cancelRefundSummary(paid));
    }

    if (action === "CANCEL_CONFIRM") {
      if (total > 0 && paid >= total) {
        return NextResponse.json(
          { error: "Fully paid tool rentals cannot be cancelled." },
          { status: 400 }
        );
      }
      await prisma.$transaction(async (tx) => {
        await tx.toolRental.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelReason: String(body.reason || "Client cancelled").slice(0, 500),
          } as any,
        });
        try {
          const qty = Math.max(1, Number((rental as any).quantity || 1));
          await tx.tool.update({
            where: { id: rental.toolId },
            data: { available: { increment: qty } },
          });
        } catch {
          /* */
        }
      });
      return NextResponse.json({
        ok: true,
        message: "Tool rental cancelled. Refund (if any) within 7 days after 10% deduction.",
      });
    }

    if (
      action === "PAY_NOW" ||
      action === "PAY_INSTALLMENT" ||
      action === "PAY_REMAINING" ||
      action === "PAY_FULL"
    ) {
      const paymentType = String((rental as any).paymentType || "UNSET").toUpperCase();
      if (!paymentType || paymentType === "UNSET") {
        return NextResponse.json(
          { error: "Choose Full or Installment payment first" },
          { status: 400 }
        );
      }

      let amount =
        action === "PAY_REMAINING" || action === "PAY_FULL"
          ? balance || total
          : Number(body.amount || 0);

      if ((action === "PAY_INSTALLMENT" || action === "PAY_NOW") && !(amount > 0)) {
        if (paymentType === "FULL") {
          amount = balance || total;
        } else {
          const schedule = parseSchedule((rental as any).scheduleJson);
          const next = schedule.find((i) => (i.status || "PENDING") === "PENDING");
          amount = Number(next?.amount || total * 0.4);
        }
      }

      if (!(amount > 0) || !Number.isFinite(amount)) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      if (balance > 0 && amount > balance) amount = balance;

      const type =
        action === "PAY_REMAINING" || action === "PAY_FULL"
          ? "PAY_REMAINING"
          : paymentType === "FULL"
            ? "FULL"
            : "INSTALLMENT";

      const isInstallment = paymentType === "INSTALLMENT";
      const hasPrior =
        paid > 0 ||
        (await prisma.payment.count({
          where: { toolRentalId: id, status: "APPROVED" },
        })) > 0;
      const autoApprove = isInstallment && hasPrior && action !== "PAY_REMAINING";

      const payment = await prisma.payment.create({
        data: {
          userId: rental.userId,
          amount,
          currency: "NGN",
          type: type === "INSTALLMENT" ? "TOOL_INSTALLMENT" : "TOOL_RENTAL",
          method: "BANK_TRANSFER",
          status: autoApprove ? "APPROVED" : "PENDING",
          toolRentalId: id,
          referenceId: id,
          reviewedAt: autoApprove ? new Date() : null,
        },
      });

      if (autoApprove) {
        const newPaid = paid + amount;
        const fully = newPaid + 0.01 >= total;
        await prisma.toolRental.update({
          where: { id },
          data: {
            installmentPaid: newPaid,
            status: fully ? "CONFIRMED" : rental.status,
          } as any,
        });
        await prisma.notification
          .create({
            data: {
              userId: rental.userId,
              title: "Tool payment recorded",
              body: `Bank transfer of ₦${amount.toLocaleString("en-NG")} applied. ${
                fully
                  ? "Tool hire fully paid."
                  : `Balance ₦${Math.max(0, total - newPaid).toLocaleString("en-NG")}.`
              }`,
              type: "PAYMENT",
              link: "/dashboard#reservations",
            },
          })
          .catch(() => null);
        return NextResponse.json({
          ok: true,
          payment,
          autoApproved: true,
          message: `Bank transfer of ₦${amount.toLocaleString("en-NG")} applied.`,
          balance: Math.max(0, total - newPaid),
          fullyPaid: fully,
        });
      }

      await prisma.notification
        .create({
          data: {
            userId: rental.userId,
            title: "Tool payment submitted",
            body: `Bank transfer of ₦${amount.toLocaleString("en-NG")} pending admin approval.`,
            type: "PAYMENT",
            link: "/dashboard#reservations",
          },
        })
        .catch(() => null);

      return NextResponse.json({
        ok: true,
        payment,
        autoApproved: false,
        message: "Bank transfer submitted for admin approval",
      });
    }

    if (action === "RETURN_COMPLETE") {
      if (session.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const { completeToolReturn } = await import("@/lib/tool-return");
      const condition = String(body.condition || "GOOD").toUpperCase();
      const mapped =
        condition === "GOOD" || condition === "FAIR" || condition === "DAMAGED" || condition === "MISSING"
          ? condition
          : condition.includes("DAMAGE")
            ? "DAMAGED"
            : condition.includes("MISS")
              ? "MISSING"
              : condition.includes("FAIR")
                ? "FAIR"
                : "GOOD";
      const result = await completeToolReturn({
        rentalId: id,
        adminId: session.id,
        adminEmail: (session as any).email,
        adminName: (session as any).name,
        condition: mapped as any,
        notes: body.notes ? String(body.notes).slice(0, 1000) : undefined,
        depositRefund: body.depositRefund != null ? Number(body.depositRefund) : undefined,
        damageCharge: body.damageCharge != null ? Number(body.damageCharge) : undefined,
        checklist: {
          bodyOk: !!body.bodyOk,
          accessoriesComplete: !!body.accessoriesComplete,
          cleaned: !!body.cleaned,
          serialMatches: !!body.serialMatches,
        },
      });
      return NextResponse.json({
        ...result,
        message: result.message || `Return recorded (${mapped}). Stock restocked.`,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action || "(empty)"}` }, { status: 400 });
  } catch (e) {
    console.error("tools/[id] POST", e);
    return NextResponse.json(
      { error: "Tool rental update failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
