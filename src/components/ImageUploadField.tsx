"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";

/**
 * Simple single-image picker + upload to /api/upload (Vercel Blob).
 * Use for services, tools, workers, profile photo.
 */
export function ImageUploadField({
  value,
  onChange,
  folder = "services",
  label = "Photo",
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | null | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image (JPEG, PNG, WebP, GIF)");
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("Image must be under 8MB");
      }
      const fd = new FormData();
      fd.append("file", file);
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
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}

      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            className="h-28 w-40 object-cover rounded-xl border border-slate-200 bg-slate-50"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow"
            title="Remove"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="h-28 w-full max-w-xs rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400">
          <ImageIcon className="w-8 h-8" />
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif"
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

      {/* Optional paste URL for external images */}
      <input
        type="url"
        placeholder="Or paste image URL"
        value={value.startsWith("http") ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border text-sm"
      />

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>
      )}
    </div>
  );
}

/** Multi-image for assets (house etc.) */
export function MultiImageUpload({
  urls,
  onChange,
  folder = "services",
  max = 8,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    setBusy(true);
    try {
      const next = [...urls];
      for (const file of Array.from(list).slice(0, max - next.length)) {
        if (!file.type.startsWith("image/")) continue;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", folder);
        const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
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
        {urls.map((u, i) => (
          <div key={u + i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-20 w-24 object-cover rounded-lg border" />
            <button
              type="button"
              className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5"
              onClick={() => onChange(urls.filter((_, j) => j !== i))}
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
        disabled={busy || urls.length >= max}
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
