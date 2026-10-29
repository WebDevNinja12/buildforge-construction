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
  "video/quicktime", // .mov
] as const;

export const ALLOWED_MEDIA_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

/** Max sizes (bytes) */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

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

export function blobConfigured() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.blob_READ_WRITE_TOKEN);
}

export function mediaFolder(kind: "image" | "video" | "document", scope: string) {
  const safe = scope.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  return `hama/${kind}/${safe}`;
}

export const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=500&fit=crop";
