"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, User, X } from "lucide-react";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i;

function looksLikeImage(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  if (!t || t === "application/octet-stream") {
    return IMAGE_EXT.test(file.name) || file.name === "image.jpg" || !file.name;
  }
  return false;
}

export function ProfileAvatarUpload({
  value,
  onChange,
  fallbackInitials,
}: {
  value: string;
  onChange: (url: string) => void;
  fallbackInitials?: string;
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
      <div className="relative">
        <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-md ring-1 ring-slate-200/80 flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Profile" className="w-full h-full object-cover" />
          ) : fallbackInitials ? (
            <span className="text-2xl font-bold text-slate-400 tracking-wide">{fallbackInitials}</span>
          ) : (
            <User className="w-12 h-12 text-slate-300" />
          )}
        </div>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-0.5 -right-0.5 bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 rounded-full p-1.5 shadow-sm transition"
            title="Remove photo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-50 shadow-sm transition"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          Choose photo
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 transition"
        >
          <Camera className="w-3.5 h-3.5" />
          Camera
        </button>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />

      <p className="text-[11px] text-slate-400 text-center max-w-[240px] leading-relaxed">
        JPEG, PNG, WebP or GIF · max 8MB
      </p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 w-full text-center">
          {error}
        </p>
      )}
    </div>
  );
}
