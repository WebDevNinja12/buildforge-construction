import { prisma } from "@/lib/prisma";
import { recordAdminActivity } from "@/lib/admin-activity";

export type ReturnCondition = "GOOD" | "FAIR" | "DAMAGED" | "MISSING";

export type ToolReturnInput = {
  rentalId: string;
  adminId: string;
  adminEmail?: string | null;
  adminName?: string | null;
  condition: ReturnCondition;
  notes?: string;
  depositRefund?: number;
  damageCharge?: number;
  checklist?: {
    bodyOk?: boolean;
    accessoriesComplete?: boolean;
    cleaned?: boolean;
    serialMatches?: boolean;
  };
};

export async function completeToolReturn(input: ToolReturnInput) {
  const rental = await prisma.toolRental.findUnique({
    where: { id: input.rentalId },
    include: { tool: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!rental) throw new Error("Rental not found");

  const status = String(rental.status || "").toUpperCase();
  if (["RETURNED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(status)) {
    throw new Error(`Rental already closed (${status})`);
  }

  const qty = Math.max(1, Number((rental as any).quantity || 1));
  const deposit = Number(rental.tool?.securityDeposit || 0);
  let depositRefund = Number(input.depositRefund ?? deposit);
  if (!Number.isFinite(depositRefund) || depositRefund < 0) depositRefund = 0;
  if (depositRefund > deposit) depositRefund = deposit;

  if (input.depositRefund == null) {
    if (input.condition === "DAMAGED") depositRefund = Math.round(deposit * 0.5);
    if (input.condition === "MISSING") depositRefund = 0;
  }

  const checklist = input.checklist || {};
  const notesParts = [
    `Condition: ${input.condition}`,
    input.notes ? `Notes: ${input.notes}` : "",
    `Checklist: body=${!!checklist.bodyOk}, accessories=${!!checklist.accessoriesComplete}, cleaned=${!!checklist.cleaned}, serial=${!!checklist.serialMatches}`,
    `Deposit refund: ₦${depositRefund}`,
    input.damageCharge ? `Damage charge noted: ₦${input.damageCharge}` : "",
  ].filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.toolRental.update({
      where: { id: rental.id },
      data: {
        status: "RETURNED",
        returnStatus: input.condition,
        returnNotes: notesParts.join(" | ").slice(0, 2000),
        depositRefunded: depositRefund,
      } as any,
    });

    await tx.tool.update({
      where: { id: rental.toolId },
      data: {
        available: { increment: qty },
        condition:
          input.condition === "GOOD" || input.condition === "FAIR"
            ? input.condition
            : rental.tool?.condition || input.condition,
      } as any,
    });
  });

  try {
    await prisma.notification.create({
      data: {
        userId: rental.userId,
        title: "Tool returned",
        body: `Your hire of ${rental.tool?.name || "tool"} was checked in (${input.condition}). Deposit refund: ₦${depositRefund}.`,
        type: "TOOL_RETURN",
        link: "/dashboard#reservations",
      },
    });
  } catch {
    /* */
  }

  await recordAdminActivity({
    adminId: input.adminId,
    adminEmail: input.adminEmail,
    adminName: input.adminName,
    action: "TOOL_RETURN_COMPLETE",
    entity: "ToolRental",
    entityId: rental.id,
    details: {
      toolId: rental.toolId,
      condition: input.condition,
      depositRefund,
      damageCharge: input.damageCharge || 0,
      qtyRestocked: qty,
      checklist,
    },
  });

  return {
    ok: true,
    rentalId: rental.id,
    condition: input.condition,
    depositRefund,
    qtyRestocked: qty,
  };
}

export async function flagOverdueToolRentals(now = new Date()) {
  const overdue = await prisma.toolRental.findMany({
    where: {
      status: { in: ["CONFIRMED", "ACTIVE", "PAID"] },
      endDate: { lt: now },
    },
    take: 100,
  });
  let flagged = 0;
  for (const r of overdue) {
    try {
      await prisma.toolRental.update({
        where: { id: r.id },
        data: {
          status: "OVERDUE",
          returnStatus: r.returnStatus || "PENDING_RETURN",
        } as any,
      });
      await prisma.notification
        .create({
          data: {
            userId: r.userId,
            title: "Tool hire period ended",
            body: "Please return the tool for inspection. Deposit is held until return is checked.",
            type: "TOOL_OVERDUE",
            link: "/dashboard#reservations",
          },
        })
        .catch(() => null);
      flagged++;
    } catch {
      /* */
    }
  }
  return flagged;
}
