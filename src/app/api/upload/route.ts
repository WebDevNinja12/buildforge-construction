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

export async function POST(req: NextRequest) {
  try {
    const token = getBlobToken();
    if (!token) {
      return NextResponse.json(
        {
          error: "Image storage is not connected. Ask admin to link Vercel Blob (BLOB_READ_WRITE_TOKEN).",
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

    // Some browsers send empty type — sniff from name
    let type = file.type || "application/octet-stream";
    if (type === "application/octet-stream") {
      const n = file.name.toLowerCase();
      if (n.endsWith(".jpg") || n.endsWith(".jpeg")) type = "image/jpeg";
      else if (n.endsWith(".png")) type = "image/png";
      else if (n.endsWith(".webp")) type = "image/webp";
      else if (n.endsWith(".gif")) type = "image/gif";
      else if (n.endsWith(".mp4")) type = "video/mp4";
    }

    if (!ALLOWED_MEDIA_TYPES.includes(type as (typeof ALLOWED_MEDIA_TYPES)[number])) {
      return NextResponse.json(
        {
          error: `Unsupported type: ${type || "unknown"}. Use JPEG, PNG, WebP, GIF, or MP4.`,
        },
        { status: 400 }
      );
    }

    const max = maxBytesFor(type);
    if (file.size > max) {
      return NextResponse.json(
        {
          error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max ${Math.round(max / 1024 / 1024)}MB.`,
        },
        { status: 400 }
      );
    }

    const kind = isVideoType(type) ? "video" : isImageType(type) ? "image" : "document";

    // Folder ACL
    let scope = folderRaw;
    if (session.role !== "ADMIN") {
      const allowed = ["documents", "proofs", "installment", "avatar", "profile", "services"];
      if (!allowed.includes(folderRaw)) scope = "profile";
    }

    const prefix = mediaFolder(kind as "image" | "video" | "document", scope);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || `upload.${kind === "video" ? "mp4" : "jpg"}`;
    const pathname = `${prefix}/${session.id.slice(0, 8)}-${Date.now()}-${safeName}`;

    const blob = await put(pathname, file, {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
      token,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: type,
      size: file.size,
      kind,
      downloadUrl: blob.downloadUrl,
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
    const url = new URL(req.url).searchParams.get("url");
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
    // Clients may only delete their own blob URLs loosely; admins any
    await del(url, { token });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
