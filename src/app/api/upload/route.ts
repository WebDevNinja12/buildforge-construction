import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import {
  ALLOWED_MEDIA_TYPES,
  getBlobToken,
  isImageType,
  isVideoType,
  maxBytesFor,
  mediaFolder,
  blobStatus,
} from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sniffImageType(file: File, current: string): string {
  let type = current || "application/octet-stream";
  if (type.startsWith("image/") || type.startsWith("video/")) {
    if (type === "image/jpg") return "image/jpeg";
    return type;
  }
  const n = (file.name || "").toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".jfif")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".avif")) return "image/avif";
  if (n.endsWith(".mp4")) return "video/mp4";
  if (n.endsWith(".webm")) return "video/webm";
  if (n.endsWith(".mov")) return "video/quicktime";
  if (n.endsWith(".pdf")) return "application/pdf";
  if (type === "application/octet-stream" || !type) return "image/jpeg";
  return type;
}

function toDisplayUrl(blobUrl: string) {
  if (blobUrl.includes(".private.blob.vercel-storage.com")) {
    return `/api/media?u=${encodeURIComponent(blobUrl)}`;
  }
  return blobUrl;
}

async function blobPut(
  pathname: string,
  body: ArrayBuffer,
  contentType: string,
  token: string,
  access: "public" | "private"
) {
  const url = `https://blob.vercel-storage.com/${pathname.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
      "x-content-type": contentType,
      "x-vercel-blob-access": access,
      "Content-Type": contentType,
    },
    body,
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.error || data?.message || text || `Blob HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as {
    url: string;
    downloadUrl?: string;
    pathname: string;
    contentType?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const token = getBlobToken();
    if (!token) {
      return NextResponse.json(
        {
          error: "Image storage token is missing. Set BLOB_READ_WRITE_TOKEN on Vercel.",
          status: blobStatus(),
        },
        { status: 503 }
      );
    }

    const session = await getSession();
    const form = await req.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") || "general");
    const isDocFolder = [
      "registration-docs",
      "documents",
      "installment",
      "installment-docs",
      "proofs",
    ].includes(folderRaw);

    if (!session && !isDocFolder) {
      return NextResponse.json({ error: "Login required to upload" }, { status: 401 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
    }

    let type = sniffImageType(file, file.type || "");
    const nameLower = (file.name || "").toLowerCase();
    if (nameLower.endsWith(".pdf") || type === "application/pdf") {
      type = "application/pdf";
    }

    const allowed =
      ALLOWED_MEDIA_TYPES.includes(type as (typeof ALLOWED_MEDIA_TYPES)[number]) ||
      type.startsWith("image/") ||
      type === "application/pdf";

    if (!allowed) {
      return NextResponse.json(
        {
          error: `Unsupported type: ${type || "unknown"}. Use PDF, JPEG, PNG, WebP, or GIF.`,
        },
        { status: 400 }
      );
    }

    const contentType =
      type === "application/pdf"
        ? "application/pdf"
        : type === "image/jpg"
          ? "image/jpeg"
          : isImageType(type) || type.startsWith("image/")
            ? type.startsWith("image/") && !isImageType(type)
              ? "image/jpeg"
              : type
            : type;

    const max =
      type === "application/pdf" || isDocFolder
        ? 5 * 1024 * 1024
        : maxBytesFor(contentType.startsWith("video/") ? contentType : "image/jpeg");
    if (file.size > max) {
      return NextResponse.json(
        {
          error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max ${Math.round(max / 1024 / 1024)}MB.`,
        },
        { status: 400 }
      );
    }

    const kind =
      type === "application/pdf" ? "document" : isVideoType(contentType) ? "video" : "image";
    let scope = folderRaw;
    if (!session) {
      scope = "registration-docs";
    } else if (session.role !== "ADMIN") {
      const allowedFolders = [
        "documents",
        "proofs",
        "installment",
        "installment-docs",
        "avatar",
        "profile",
        "services",
        "registration-docs",
      ];
      if (!allowedFolders.includes(folderRaw)) scope = "avatar";
    }

    const prefix = mediaFolder(kind as "image" | "video" | "document", scope);
    const owner = session?.id?.slice(0, 8) || "reg";
    const safeName =
      (file.name || (kind === "document" ? "doc.pdf" : kind === "video" ? "clip.mp4" : "photo.jpg"))
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80) || "file.bin";
    const pathname = `${prefix}/${owner}-${Date.now()}-${safeName}`;

    const buffer = await file.arrayBuffer();

    let blob: { url: string; pathname: string; contentType?: string } | null = null;
    let usedAccess: "public" | "private" = "private";
    let lastMsg = "";

    for (const access of ["private", "public"] as const) {
      try {
        blob = await blobPut(pathname, buffer, contentType, token, access);
        usedAccess = access;
        break;
      } catch (e) {
        lastMsg = e instanceof Error ? e.message : String(e);
        if (/private store|public access|must be/i.test(lastMsg)) continue;
        if (/access denied|invalid token|unauthorized|forbidden/i.test(lastMsg)) {
          return NextResponse.json(
            {
              error: "Blob token is invalid. Update BLOB_READ_WRITE_TOKEN from Vercel Storage.",
              detail: lastMsg,
              status: blobStatus(),
            },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: lastMsg }, { status: 400 });
      }
    }

    if (!blob?.url) {
      return NextResponse.json({ error: lastMsg || "Upload failed" }, { status: 400 });
    }

    return NextResponse.json({
      url: toDisplayUrl(blob.url),
      blobUrl: blob.url,
      pathname: blob.pathname,
      contentType,
      size: file.size,
      kind,
      access: usedAccess,
    });
  } catch (e) {
    console.error("upload", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }
    const token = getBlobToken();
    if (!token) {
      return NextResponse.json({ error: "Blob not configured" }, { status: 503 });
    }
    let url = new URL(req.url).searchParams.get("url") || "";
    if (url.includes("/api/media")) {
      try {
        const u = new URL(url, "https://x");
        url = u.searchParams.get("u") || url;
      } catch {
        /* */
      }
    }
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
    await del(url, { token });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
