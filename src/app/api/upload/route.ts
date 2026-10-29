import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { getSession } from "@/lib/auth";
import {
  ALLOWED_MEDIA_TYPES,
  blobConfigured,
  isImageType,
  isVideoType,
  maxBytesFor,
  mediaFolder,
} from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart/form-data
 * fields: file (required), folder? (optional scope e.g. services|documents|workers|banner)
 *
 * Requires login. Admin can upload any folder; clients only documents/proof.
 */
export async function POST(req: NextRequest) {
  try {
    if (!blobConfigured()) {
      return NextResponse.json(
        {
          error: "Vercel Blob is not connected",
          setup: [
            "Open Vercel → Project → Storage → Create Blob store",
            "Connect store to project buildforge-construction",
            "Ensure env BLOB_READ_WRITE_TOKEN is set for Production",
            "Redeploy after connecting",
          ],
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
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }

    const type = file.type || "application/octet-stream";
    if (!ALLOWED_MEDIA_TYPES.includes(type as (typeof ALLOWED_MEDIA_TYPES)[number])) {
      return NextResponse.json(
        {
          error: `Unsupported type: ${type}. Allowed: JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV`,
        },
        { status: 400 }
      );
    }

    const max = maxBytesFor(type);
    if (file.size > max) {
      return NextResponse.json(
        {
          error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Max ${Math.round(max / 1024 / 1024)}MB for this type.`,
        },
        { status: 400 }
      );
    }

    // Clients may only upload proofs/documents; admin unrestricted
    const kind = isVideoType(type) ? "video" : isImageType(type) ? "image" : "document";
    let scope = folderRaw;
    if (session.role !== "ADMIN") {
      const allowed = ["documents", "proofs", "installment", "avatar"];
      if (!allowed.includes(folderRaw)) scope = "documents";
    }

    const prefix = mediaFolder(kind as "image" | "video" | "document", scope);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const pathname = `${prefix}/${Date.now()}-${safeName}`;

    const blob = await put(pathname, file, {
      access: "public",
      contentType: type,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN || process.env.blob_READ_WRITE_TOKEN,
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

/** DELETE ?url=https://...blob.vercel-storage.com/...  (admin only) */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    if (!blobConfigured()) {
      return NextResponse.json({ error: "Blob not configured" }, { status: 503 });
    }
    const url = new URL(req.url).searchParams.get("url");
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
    await del(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN || process.env.blob_READ_WRITE_TOKEN,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
