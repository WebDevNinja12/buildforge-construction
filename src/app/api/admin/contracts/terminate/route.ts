import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/lib/super-admin";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let email = (session as any).email as string | undefined;
  let name = session.name;
  try {
    const u = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true, name: true },
    });
    email = u?.email || email;
    name = u?.name || name;
  } catch {
    /* */
  }

  const gate = await assertSuperAdmin({ ...session, email });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }

  try {
    const body = await req.json();
    const contractId = String(body.contractId || "");
    const reason = String(body.reason || "").trim();
    if (!contractId) {
      return NextResponse.json({ error: "contractId required" }, { status: 400 });
    }
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "Termination reason required (min 5 characters)" },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { reservation: true },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (String(contract.status).toUpperCase() === "TERMINATED") {
      return NextResponse.json({ error: "Already terminated" }, { status: 400 });
    }

    const meta = {
      terminatedAt: new Date().toISOString(),
      terminatedBy: session.id,
      terminatedByEmail: email,
      reason,
      previousStatus: contract.status,
    };

    await prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: contractId },
        data: {
          status: "TERMINATED",
          metaJson: JSON.stringify(meta),
        } as any,
      });

      if (contract.reservationId) {
        await tx.reservation.update({
          where: { id: contract.reservationId },
          data: {
            status: "TERMINATED",
            cancelReason: `Contract terminated: ${reason}`.slice(0, 500),
          } as any,
        });
      }

      if (body.forceReleaseAsset && contract.reservation?.assetId) {
        await tx.asset.update({
          where: { id: contract.reservation.assetId },
          data: { status: "AVAILABLE", active: true },
        });
      }
    });

    await prisma.notification
      .create({
        data: {
          userId: contract.userId,
          title: "Contract terminated",
          body: `Your contract ${contract.contractNumber} was terminated. Reason: ${reason}`,
          type: "CONTRACT_TERMINATED",
          link: "/dashboard#contracts",
        },
      })
      .catch(() => null);

    await recordAdminActivity({
      adminId: session.id,
      adminEmail: email,
      adminName: name,
      action: "CONTRACT_TERMINATE",
      entity: "Contract",
      entityId: contractId,
      details: meta,
    });

    return NextResponse.json({
      ok: true,
      message: "Contract terminated",
      contractId,
      reason,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
