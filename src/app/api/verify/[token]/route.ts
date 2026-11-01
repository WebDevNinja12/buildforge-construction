import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const contract = await prisma.contract.findUnique({
    where: { verifyToken: token },
    include: {
      reservation: { include: { asset: true } },
      user: { select: { name: true, id: true } },
    },
  });

  if (!contract) {
    return NextResponse.json({ valid: false, reason: "Contract not found" }, { status: 404 });
  }

  const session = await getSession();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  await prisma.verificationScan
    .create({
      data: {
        contractId: contract.id,
        scannedBy: session?.id || null,
        ip: ip.slice(0, 120),
        userAgent: (req.headers.get("user-agent") || "").slice(0, 200),
      },
    })
    .catch(() => null);

  const status = (contract.status || "").toUpperCase();
  const valid = ["ACTIVE", "COMPLETED"].includes(status);

  const publicPayload: Record<string, unknown> = {
    valid,
    reason: valid ? null : `Not valid — status is ${status}`,
    clientName: contract.clientName || contract.user?.name,
    contractNumber: contract.contractNumber,
    service: contract.serviceTitle,
    status: contract.status,
    issuedAt: contract.issuedAt,
  };

  if (session?.role === "ADMIN") {
    publicPayload.extra = {
      paymentMethod: contract.paymentMethod,
      totalAmount: contract.totalAmount,
      userId: contract.userId,
      reservationId: contract.reservationId,
      balance: contract.reservation
        ? Math.max(
            0,
            Number(contract.reservation.installmentTotal || contract.totalAmount || 0) -
              Number(contract.reservation.installmentPaid || 0)
          )
        : null,
    };
  }

  return NextResponse.json(publicPayload);
}
