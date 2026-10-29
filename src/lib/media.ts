/** Shared media rules for images & videos (Vercel Blob). */

export const IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ALLOWED_MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function isImageType(type: string) {
  return IMAGE_TYPES.includes(type as (typeof IMAGE_TYPES)[number]);
}

export function isVideoType(type: string) {
  return VIDEO_TYPES.includes(type as (typeof VIDEO_TYPES)[number]);
}

export function maxBytesFor(type: string) {
  if (isVideoType(type)) return MAX_VIDEO_BYTES;
  return MAX_IMAGE_BYTES;
}

/**
 * Vercel names Blob env vars from the store name:
 * - default → BLOB_READ_WRITE_TOKEN
 * - store "construction" → construction_READ_WRITE_TOKEN + construction_STORE_ID
 * - store "construction-house" → construction_house_READ_WRITE_TOKEN
 */
export function getBlobToken(): string | undefined {
  const candidates = [
    process.env.BLOB_READ_WRITE_TOKEN,
    process.env.construction_READ_WRITE_TOKEN,
    process.env.construction_house_READ_WRITE_TOKEN,
    process.env.CONSTRUCTION_READ_WRITE_TOKEN,
  ];
  for (const c of candidates) {
    if (c && c.trim().length > 10) return c.trim();
  }
  return undefined;
}

export function getBlobStoreId(): string | undefined {
  return (
    process.env.BLOB_STORE_ID ||
    process.env.construction_STORE_ID ||
    process.env.construction_house_STORE_ID ||
    undefined
  );
}

export function blobConfigured() {
  return !!getBlobToken();
}

export function blobStatus() {
  const token = getBlobToken();
  const storeId = getBlobStoreId();
  return {
    connected: !!token,
    storeLinked: !!storeId,
    storeId: storeId || null,
    tokenEnv: token
      ? process.env.BLOB_READ_WRITE_TOKEN
        ? "BLOB_READ_WRITE_TOKEN"
        : process.env.construction_READ_WRITE_TOKEN
          ? "construction_READ_WRITE_TOKEN"
          : process.env.construction_house_READ_WRITE_TOKEN
            ? "construction_house_READ_WRITE_TOKEN"
            : "detected"
      : null,
    note: token
      ? "Blob uploads enabled"
      : storeId
        ? `Store linked (${storeId}) but READ_WRITE_TOKEN missing. In Vercel Storage open the store and reconnect so construction_READ_WRITE_TOKEN (or BLOB_READ_WRITE_TOKEN) is injected, then redeploy.`
        : "No Blob store linked. Create/connect store construction-house (or construction) in Vercel Storage.",
  };
}

export function mediaFolder(kind: "image" | "video" | "document", scope: string) {
  const safe = scope.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  return `hama/${kind}/${safe}`;
}

export const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=500&fit=crop";
