import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  allowsExtension,
  calcExtensionFee,
  DEFAULT_EXTENSION,
  extensionEligibleStatus,
} from "@/lib/booking-rules";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kindRaw = String(body.kind || "").toUpperCase();
    const kind =
      kindRaw === "HOTEL" || kindRaw === "RESERVATION" || kindRaw === "ASSET"
        ? "ASSET"
        : kindRaw === "TOOL" || kindRaw === "TOOLS"
          ? "TOOL"
          : kindRaw === "WORKER" || kindRaw === "HIRE"
            ? "WORKER"
            : null;
    const id = String(body.id || "").trim();
    const extraDays = Math.floor(Number(body.extraDays || 0));
    const action = String(body.action || "CONFIRM").toUpperCase();

    if (!kind || !id) {
      return NextResponse.json(
        { error: "kind (HOTEL|TOOL|WORKER) and id are required" },
        { status: 400 }
      );
    }
    if (!(extraDays >= DEFAULT_EXTENSION.minDays)) {
      return NextResponse.json(
        { error: `extraDays must be at least ${DEFAULT_EXTENSION.minDays}` },
        { status: 400 }
      );
    }
    if (extraDays > DEFAULT_EXTENSION.maxDays) {
      return NextResponse.json(
        { error: `Maximum extension is ${DEFAULT_EXTENSION.maxDays} days` },
        { status: 400 }
      );
    }

    if (kind === "ASSET") {
      const plan = await prisma.reservation.findUnique({
        where: { id },
        include: {
          asset: true,
          payments: { where: { status: "APPROVED" }, select: { amount: true } },
        },
      });
      if (!plan || plan.userId !== session.id) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      const cat = String(plan.asset?.type || "").toUpperCase();
      if (!allowsExtension("ASSET", cat)) {
        return NextResponse.json(
          { error: "Extensions are only available for hotel bookings after full payment." },
          { status: 400 }
        );
      }
      const paidSum =
        Number(plan.installmentPaid || 0) ||
        plan.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const total = Number(plan.installmentTotal || plan.asset?.price || 0);
      const paidEnough = paidSum >= total && total > 0;
      if (!extensionEligibleStatus(plan.status, paidEnough)) {
        return NextResponse.json(
          {
            error:
              "Complete full payment on this hotel booking before requesting an extension.",
          },
          { status: 400 }
        );
      }

      const feePercent = DEFAULT_EXTENSION.feePercent;
      const { fee, note } = calcExtensionFee({
        baseAmount: total || paidSum,
        extraDays,
        feePercent,
      });

      if (action === "QUOTE") {
        return NextResponse.json({
          ok: true,
          extraDays,
          fee,
          note,
          message: `Extend hotel stay by ${extraDays} day(s). Fee: ₦${fee.toLocaleString("en-NG")}.`,
        });
      }

      const payment = await prisma.payment.create({
        data: {
          userId: session.id,
          amount: fee,
          currency: "NGN",
          type: "EXTENSION",
          method: "MANUAL",
          status: "PENDING",
          reservationId: id,
          referenceId: id,
        },
      });

      const baseEnd = plan.expiresAt || plan.planDeadlineAt || new Date();
      const newEnd = new Date(baseEnd);
      newEnd.setDate(newEnd.getDate() + extraDays);

      await prisma.notification
        .create({
          data: {
            userId: session.id,
            title: "Hotel extension requested",
            body: `You requested +${extraDays} day(s). Extension fee ₦${fee.toLocaleString("en-NG")} is pending admin approval. Proposed new end: ${newEnd.toISOString().slice(0, 10)}.`,
            type: "RESERVATION",
            link: "/dashboard#plans",
          },
        })
        .catch(() => null);

      return NextResponse.json({
        ok: true,
        payment,
        proposedEndDate: newEnd.toISOString(),
        fee,
        note,
        message:
          "Extension requested. Extension fee pending admin approval; hotel dates update after approval.",
      });
    }

    if (kind === "TOOL") {
      const rental = await prisma.toolRental.findUnique({
        where: { id },
        include: {
          tool: true,
          payments: { where: { status: "APPROVED" }, select: { amount: true } },
        },
      });
      if (!rental || rental.userId !== session.id) {
        return NextResponse.json({ error: "Tool rental not found" }, { status: 404 });
      }
      const paid =
        rental.payments.length > 0 ||
        ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(rental.status);
      if (!extensionEligibleStatus(rental.status, paid)) {
        return NextResponse.json(
          { error: "Pay for this tool rental first, then you can extend the hire period." },
          { status: 400 }
        );
      }

      const daily = Number(rental.tool?.dailyRate || 0);
      const { fee, note } = calcExtensionFee({
        baseAmount: Number(rental.total || daily || 0),
        dailyRate: daily,
        extraDays,
      });

      if (action === "QUOTE") {
        return NextResponse.json({
          ok: true,
          extraDays,
          fee,
          note,
          message: `Extend tool hire by ${extraDays} day(s). Fee: ₦${fee.toLocaleString("en-NG")}.`,
        });
      }

      const payment = await prisma.payment.create({
        data: {
          userId: session.id,
          amount: fee,
          currency: "NGN",
          type: "EXTENSION",
          method: "MANUAL",
          status: "PENDING",
          toolRentalId: id,
          referenceId: id,
        },
      });

      const baseEnd = rental.endDate || rental.expiresAt || new Date();
      const newEnd = new Date(baseEnd);
      newEnd.setDate(newEnd.getDate() + extraDays);

      await prisma.toolRental.update({
        where: { id },
        data: { endDate: newEnd },
      });

      await prisma.notification
        .create({
          data: {
            userId: session.id,
            title: "Tool hire extended",
            body: `Hire extended by ${extraDays} day(s) to ${newEnd.toISOString().slice(0, 10)}. Extension fee ₦${fee.toLocaleString("en-NG")} pending approval.`,
            type: "PAYMENT",
            link: "/dashboard#plans",
          },
        })
        .catch(() => null);

      return NextResponse.json({
        ok: true,
        payment,
        endDate: newEnd.toISOString(),
        fee,
        note,
        message: "Tool hire extended. Extension fee submitted for admin approval.",
      });
    }

    const hire = await prisma.hireRequest.findUnique({
      where: { id },
      include: {
        worker: true,
        payments: { where: { status: "APPROVED" }, select: { amount: true } },
      },
    });
    if (!hire || hire.userId !== session.id) {
      return NextResponse.json({ error: "Hire request not found" }, { status: 404 });
    }
    const paid =
      hire.payments.length > 0 || ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(hire.status);
    if (!extensionEligibleStatus(hire.status, paid)) {
      return NextResponse.json(
        { error: "Pay for this worker hire first, then you can extend the period." },
        { status: 400 }
      );
    }

    const daily = Number(hire.worker?.dailyRate || 0);
    const { fee, note } = calcExtensionFee({
      baseAmount: Number(hire.total || daily || 0),
      dailyRate: daily,
      extraDays,
    });

    if (action === "QUOTE") {
      return NextResponse.json({
        ok: true,
        extraDays,
        fee,
        note,
        message: `Extend worker hire by ${extraDays} day(s). Fee: ₦${fee.toLocaleString("en-NG")}.`,
      });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: session.id,
        amount: fee,
        currency: "NGN",
        type: "EXTENSION",
        method: "MANUAL",
        status: "PENDING",
        hireRequestId: id,
        referenceId: id,
      },
    });

    const baseEnd = hire.endDate || hire.expiresAt || new Date();
    const newEnd = new Date(baseEnd);
    newEnd.setDate(newEnd.getDate() + extraDays);

    await prisma.hireRequest.update({
      where: { id },
      data: { endDate: newEnd },
    });

    await prisma.notification
      .create({
        data: {
          userId: session.id,
          title: "Worker hire extended",
          body: `Hire extended by ${extraDays} day(s) to ${newEnd.toISOString().slice(0, 10)}. Extension fee ₦${fee.toLocaleString("en-NG")} pending approval.`,
          type: "PAYMENT",
          link: "/dashboard#plans",
        },
      })
      .catch(() => null);

    return NextResponse.json({
      ok: true,
      payment,
      endDate: newEnd.toISOString(),
      fee,
      note,
      message: "Worker hire extended. Extension fee submitted for admin approval.",
    });
  } catch (e) {
    console.error("extend POST", e);
    return NextResponse.json(
      { error: "Extension failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
