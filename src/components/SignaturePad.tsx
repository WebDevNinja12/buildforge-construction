"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, PenLine, Upload, Check } from "lucide-react";

type Props = {
  existingUrl?: string | null;
  onSaved?: (url: string) => void;
};

export function SignaturePad({ existingUrl, onSaved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPreview(existingUrl || null);
  }, [existingUrl]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = c.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    drawing.current = true;
    c.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }

  function onUp() {
    drawing.current = false;
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const r = c.getBoundingClientRect();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
    // redraw scale already applied via transform from init - re-init stroke style
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasInk(false);
  }

  async function saveDrawn() {
    const c = canvasRef.current;
    if (!c || !hasInk) {
      setMsg("Draw your signature first");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        c.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) throw new Error("Could not capture signature");
      const file = new File([blob], "signature.png", { type: "image/png" });
      await upload(file);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    const ok =
      file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!ok) throw new Error("Upload a PNG or JPG signature image");
    if (file.size > 3 * 1024 * 1024) throw new Error("Max 3MB for signature");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "signatures");
    const up = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
    const upText = await up.text();
    let upData: any = {};
    try {
      upData = JSON.parse(upText);
    } catch {
      throw new Error("Upload failed");
    }
    if (!up.ok) throw new Error(upData.error || "Upload failed");
    const url = upData.url || upData.blobUrl;
    if (!url) throw new Error("No URL returned");

    const res = await fetch("/api/signature", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signatureUrl: url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not save signature");

    setPreview(url);
    setMsg("Signature saved — it will appear on your agreement PDF.");
    onSaved?.(url);
  }

  return (
    <div className="border rounded-xl p-3 sm:p-4 space-y-3 bg-slate-50">
      <div className="flex items-center gap-2">
        <PenLine className="w-4 h-4 text-primary-600" />
        <h4 className="font-semibold text-sm text-construction-dark">Your signature</h4>
      </div>
      <p className="text-xs text-slate-500">
        Draw or upload your signature. It is saved to your profile and stamped automatically on the
        installment agreement PDF you download.
      </p>

      {preview && (
        <div className="bg-white border rounded-lg p-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Saved signature" className="h-16 object-contain" />
          <p className="text-[10px] text-green-700 flex items-center gap-1 mt-1">
            <Check className="w-3 h-3" /> Saved
          </p>
        </div>
      )}

      <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-36 cursor-crosshair block"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 text-xs font-semibold border px-3 py-2 rounded-lg"
        >
          <Eraser className="w-3.5 h-3.5" /> Clear
        </button>
        <button
          type="button"
          disabled={busy || !hasInk}
          onClick={saveDrawn}
          className="inline-flex items-center gap-1 text-xs font-semibold bg-primary-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
          Save drawn signature
        </button>
        <label className="inline-flex items-center gap-1 text-xs font-semibold border px-3 py-2 rounded-lg cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Upload image
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              setMsg("");
              try {
                await upload(f);
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Upload failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {msg && <p className="text-xs text-slate-600">{msg}</p>}
    </div>
  );
}
