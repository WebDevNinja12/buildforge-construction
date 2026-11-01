import { NextRequest, NextResponse } from "next/server";
import { getBlobToken } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy private Vercel Blob files so <img src> works without client-side auth.
 * Usage: /api/media?u=https://....private.blob.vercel-storage.com/...
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("u");
    if (!raw) {
      return NextResponse.json({ error: "Missing u=blobUrl" }, { status: 400 });
    }

    let blobUrl: string;
    try {
      blobUrl = decodeURIComponent(raw);
    } catch {
      blobUrl = raw;
    }

    // Only allow vercel blob hosts
    let host = "";
    try {
      host = new URL(blobUrl).hostname;
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    if (!host.endsWith(".blob.vercel-storage.com") && !host.includes("vercel-storage.com")) {
      return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    const token = getBlobToken();
    if (!token) {
      return NextResponse.json({ error: "Blob not configured" }, { status: 503 });
    }

    const upstream = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Blob fetch failed (${upstream.status})` },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("media proxy", e);
    return NextResponse.json({ error: "Media proxy failed" }, { status: 500 });
  }
}
