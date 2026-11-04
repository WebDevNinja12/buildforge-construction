"use client";

import { useRef, useState } from "react";
import { Loader2, X, ImageIcon } from "lucide-react";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i;

function looksLikeImage(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  if (!t || t === "application/octet-stream") {
    return IMAGE_EXT.test(file.name) || true;
  }
  return false;
}

function normalizeFile(file: File): File {
  let type = file.type;
  let name = file.name || `upload-${Date.now()}.jpg`;
  if (!type || type === "application/octet-stream") {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png")) type = "image/png";
    else if (lower.endsWith(".webp")) type = "image/webp";
    else if (lower.endsWith(".gif")) type = "image/gif";
    else type = "image/jpeg";
    if (!name.includes(".")) name = `${name}.jpg`;
    return new File([file], name, { type });
  }
  return file;
}

export function ImageUploadField({
  value,
  onChange,
  folder = "services",
  label = "Photo",
  hint,
  circular = false,
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  hint?: string;
  circular?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | null | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (!looksLikeImage(file)) {
        throw new Error("Please choose a valid image (JPEG, PNG, WebP, GIF)");
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("Image must be under 8MB");
      }
      const normalized = normalizeFile(file);
      const fd = new FormData();
      fd.append("file", normalized);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      if (!data.url) throw new Error("No URL returned from upload");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}

      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className={
              circular
                ? "h-24 w-24 rounded-full object-cover border"
                : "h-28 w-full max-w-xs rounded-xl object-cover border"
            }
          />
          <button
            type="button"
            className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5"
            onClick={() => onChange("")}
            aria-label="Remove image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div
          className={
            circular
              ? "h-24 w-24 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400"
              : "h-28 w-full max-w-xs rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400"
          }
        >
          <ImageIcon className="w-8 h-8" />
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.heic"
          capture="environment"
          className="block w-full max-w-xs text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary-600 file:text-white file:font-semibold file:cursor-pointer"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {busy && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>
      )}
    </div>
  );
}

export function MultiImageUpload({
  urls,
  value,
  onChange,
  folder = "services",
  max = 8,
}: {
  urls?: string[];
  /** Alias for urls (admin Services page uses value) */
  value?: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  max?: number;
}) {
  const list = Array.isArray(urls) ? urls : Array.isArray(value) ? value : [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    try {
      const next = [...list];
      for (const file of Array.from(files).slice(0, Math.max(0, max - next.length))) {
        if (!looksLikeImage(file)) continue;
        const normalized = normalizeFile(file);
        const fd = new FormData();
        fd.append("file", normalized);
        fd.append("folder", folder);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Upload failed");
        if (data.url) next.push(data.url);
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Service images (choose files)</p>
      <div className="flex flex-wrap gap-2">
        {list.map((u, i) => (
          <div key={`${u}-${i}`} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-20 w-24 object-cover rounded-lg border" />
            <button
              type="button"
              className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              aria-label="Remove image"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={busy || list.length >= max}
        onChange={(e) => onFiles(e.target.files)}
        className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary-600 file:text-white file:font-semibold"
      />
      {busy && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
