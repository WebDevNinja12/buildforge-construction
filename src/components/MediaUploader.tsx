"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, X, Image as ImageIcon, Film } from "lucide-react";

export type UploadedMedia = {
  url: string;
  kind: "image" | "video" | string;
  contentType?: string;
};

/**
 * Upload images/videos via /api/upload → Vercel Blob.
 * Falls back with clear error if Blob is not connected.
 */
export function MediaUploader({
  folder = "services",
  accept = "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime",
  multiple = true,
  maxFiles = 12,
  value = [],
  onChange,
  label = "Images & videos",
}: {
  folder?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  value?: UploadedMedia[];
  onChange: (files: UploadedMedia[]) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    setBusy(true);
    try {
      const next = [...value];
      for (const file of Array.from(list).slice(0, maxFiles - value.length)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", folder);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        next.push({ url: data.url, kind: data.kind, contentType: data.contentType });
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(i: number) {
    const url = value[i]?.url;
    onChange(value.filter((_, idx) => idx !== i));
    // Best-effort delete from Blob (admin session)
    if (url) {
      fetch(`/api/upload?url=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => null);
    }
  }

  function setMain(i: number) {
    if (i === 0) return;
    const copy = [...value];
    const [item] = copy.splice(i, 1);
    copy.unshift(item);
    onChange(copy);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <button
          type="button"
          disabled={busy || value.length >= maxFiles}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 whitespace-pre-wrap">
          {error}
        </p>
      )}

      {value.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-200 rounded-xl py-8 text-sm text-slate-500 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
        >
          Drop or choose images (JPEG/PNG/WebP, max 8MB) or videos (MP4/WebM, max 100MB)
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {value.map((m, i) => (
            <div key={m.url + i} className="relative group rounded-lg overflow-hidden border bg-slate-100 aspect-video">
              {m.kind === "video" || m.contentType?.startsWith("video/") ? (
                <video src={m.url} className="w-full h-full object-cover" muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-start justify-between p-1.5">
                <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  {m.kind === "video" ? <Film className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                  {i === 0 ? "Main" : `#${i + 1}`}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  {i !== 0 && (
                    <button type="button" onClick={() => setMain(i)} className="text-[10px] bg-white text-slate-800 px-1.5 py-0.5 rounded">
                      Main
                    </button>
                  )}
                  <button type="button" onClick={() => removeAt(i)} className="bg-red-600 text-white p-0.5 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
