import { prisma } from "@/lib/prisma";
import { recordAdminActivity } from "@/lib/admin-activity";

export async function archiveSoldAsset(opts: {
  assetId: string;
  adminId: string;
  adminEmail?: string | null;
  adminName?: string | null;
  note?: string;
}) {
  const asset = await prisma.asset.findUnique({ where: { id: opts.assetId } });
  if (!asset) throw new Error("Asset not found");
  const status = String(asset.status || "").toUpperCase();
  if (status !== "SOLD" && status !== "ARCHIVED") {
    throw new Error("Only sold items can be archived. Mark sold via full payment first.");
  }

  await prisma.asset.update({
    where: { id: opts.assetId },
    data: {
      status: "ARCHIVED",
      active: false,
    } as any,
  });

  await recordAdminActivity({
    adminId: opts.adminId,
    adminEmail: opts.adminEmail,
    adminName: opts.adminName,
    action: "ASSET_ARCHIVE",
    entity: "Asset",
    entityId: opts.assetId,
    details: { previousStatus: status, note: opts.note || null, title: asset.title },
  });

  return { ok: true, status: "ARCHIVED" };
}

export async function reopenAssetForSale(opts: {
  assetId: string;
  adminId: string;
  adminEmail?: string | null;
  adminName?: string | null;
  price?: number;
  description?: string;
  title?: string;
  note?: string;
}) {
  const asset = await prisma.asset.findUnique({ where: { id: opts.assetId } });
  if (!asset) throw new Error("Asset not found");
  const status = String(asset.status || "").toUpperCase();
  if (!["SOLD", "ARCHIVED"].includes(status)) {
    throw new Error("Only SOLD or ARCHIVED assets can be reopened for sale");
  }

  const active = await prisma.reservation.findFirst({
    where: {
      assetId: opts.assetId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
  });
  if (active) {
    throw new Error("Active reservation still linked. Cancel or complete it first.");
  }

  const data: Record<string, unknown> = {
    status: "AVAILABLE",
    active: true,
  };
  if (opts.price != null && Number.isFinite(opts.price) && opts.price > 0) {
    data.price = opts.price;
  }
  if (opts.description) data.description = opts.description;
  if (opts.title) data.title = opts.title;

  await prisma.asset.update({
    where: { id: opts.assetId },
    data: data as any,
  });

  await recordAdminActivity({
    adminId: opts.adminId,
    adminEmail: opts.adminEmail,
    adminName: opts.adminName,
    action: "ASSET_REOPEN_SALE",
    entity: "Asset",
    entityId: opts.assetId,
    details: {
      previousStatus: status,
      newPrice: data.price ?? asset.price,
      note: opts.note || null,
      title: opts.title || asset.title,
    },
  });

  return { ok: true, status: "AVAILABLE", price: data.price ?? asset.price };
}
