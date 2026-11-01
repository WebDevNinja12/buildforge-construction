"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, User, X } from "lucide-react";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i;

function looksLikeImage(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  // Mobile camera / some Android pickers leave type empty or octet-stream
  if (!t || t === "application/octet-stream") {
    return IMAGE_EXT.test(file.name) || file.name === "image.jpg" || !file.name;
  }
  return false;
}

/**
 * Circular profile photo — pick from gallery or open camera.
 */
export function ProfileAvatarUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | null | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (!looksLikeImage(file)) {
        throw new Error("Please choose a valid image (JPEG, PNG, WebP, or GIF).");
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("Image must be under 8MB.");
      }

      // Normalize empty type for API
      let blob: Blob = file;
      let filename = file.name || `photo-${Date.now()}.jpg`;
      let type = file.type;
      if (!type || type === "application/octet-stream") {
        const lower = filename.toLowerCase();
        if (lower.endsWith(".png")) type = "image/png";
        else if (lower.endsWith(".webp")) type = "image/webp";
        else if (lower.endsWith(".gif")) type = "image/gif";
        else type = "image/jpeg";
        if (!filename.includes(".")) filename = `${filename}.jpg`;
        blob = new File([file], filename, { type });
      }

      const fd = new FormData();
      fd.append("file", blob, filename);
      fd.append("folder", "avatar");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      if (!data.url) throw new Error("Upload did not return an image URL");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm font-medium text-slate-700 self-start">Profile photo</p>

      <div className="relative">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary-100 bg-slate-100 shadow-inner flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-14 h-14 text-slate-300" />
          )}
        </div>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-1.5 shadow"
            title="Remove photo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50"
        >
          <ImagePlus className="w-4 h-4" />
          Choose from device
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
          Take photo
        </button>
      </div>

      {/* Gallery / files */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {/* Camera (mobile) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />

      <p className="text-xs text-slate-500 text-center max-w-xs">
        JPEG, PNG, WebP or GIF · max 8MB. On phones you can open the camera or pick from gallery.
      </p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 w-full text-center">
          {error}
        </p>
      )}
    </div>
  );
}
