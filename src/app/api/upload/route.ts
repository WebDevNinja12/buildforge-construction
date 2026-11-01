import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
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
  if (type === "application/octet-stream" || !type) return "image/jpeg";
  return type;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBlobToken();
    if (!token) {
      return NextResponse.json(
        {
          error:
            "Image storage token is missing. In Vercel → Storage → open store \"construction\" → Connect to project, then Redeploy.",
          status: blobStatus(),
        },
        { status: 503 }
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Login required to upload" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") || "general");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
    }

    const type = sniffImageType(file, file.type || "");
    const allowed =
      ALLOWED_MEDIA_TYPES.includes(type as (typeof ALLOWED_MEDIA_TYPES)[number]) ||
      type.startsWith("image/");

    if (!allowed) {
      return NextResponse.json(
        { error: `Unsupported type: ${type || "unknown"}. Use JPEG, PNG, WebP, or GIF.` },
        { status: 400 }
      );
    }

    const contentType =
      type === "image/jpg"
        ? "image/jpeg"
        : isImageType(type) || type.startsWith("image/")
          ? type.startsWith("image/") && !isImageType(type)
            ? "image/jpeg"
            : type
          : type;

    const max = maxBytesFor(contentType.startsWith("video/") ? contentType : "image/jpeg");
    if (file.size > max) {
      return NextResponse.json(
        {
          error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max ${Math.round(max / 1024 / 1024)}MB.`,
        },
        { status: 400 }
      );
    }

    const kind = isVideoType(contentType) ? "video" : "image";
    let scope = folderRaw;
    if (session.role !== "ADMIN") {
      const allowedFolders = ["documents", "proofs", "installment", "avatar", "profile", "services"];
      if (!allowedFolders.includes(folderRaw)) scope = "avatar";
    }

    const prefix = mediaFolder(kind as "image" | "video" | "document", scope);
    const safeName =
      (file.name || `photo.${kind === "video" ? "mp4" : "jpg"}`)
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80) || "photo.jpg";
    const pathname = `${prefix}/${session.id.slice(0, 8)}-${Date.now()}-${safeName}`;

    try {
      const blob = await put(pathname, file, {
        access: "public",
        contentType,
        addRandomSuffix: true,
        token,
      });

      return NextResponse.json({
        url: blob.url,
        pathname: blob.pathname,
        contentType,
        size: file.size,
        kind,
        downloadUrl: blob.downloadUrl,
      });
    } catch (blobErr) {
      const msg = blobErr instanceof Error ? blobErr.message : String(blobErr);
      console.error("blob put", msg);
      if (/access denied|invalid token|unauthorized|forbidden/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              "Blob token is invalid or not linked to this project. Fix: Vercel Dashboard → Storage → store \"construction\" → Settings / Connect Project → copy the Read-Write Token → Project Settings → Environment Variables → set BLOB_READ_WRITE_TOKEN (or construction_READ_WRITE_TOKEN) for Production → Redeploy.",
            detail: msg,
            status: blobStatus(),
          },
          { status: 403 }
        );
      }
      throw blobErr;
    }
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
    const url = new URL(req.url).searchParams.get("url");
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
    await del(url, { token });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
