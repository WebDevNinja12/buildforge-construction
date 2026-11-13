"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  QrCode,
  Camera,
  CameraOff,
  ShieldCheck,
  ShieldX,
  Keyboard,
} from "lucide-react";

type VerifyResult = {
  valid?: boolean;
  reason?: string;
  clientName?: string;
  contractNumber?: string;
  service?: string;
  status?: string;
  issuedAt?: string;
  extra?: {
    paymentMethod?: string;
    totalAmount?: number | string;
    balance?: number | string;
  };
};

function extractToken(input: string): string {
  const t = input.trim();
  const m = t.match(/\/verify\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  const only = t.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
  if (only.includes("/")) {
    const parts = only.split("/");
    return parts[parts.length - 1] || t;
  }
  return t;
}

export default function AdminScanPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"camera" | "paste">("camera");
  const [camError, setCamError] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef(0);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const lookup = useCallback(async (raw: string) => {
    const code = extractToken(raw);
    if (!code) return;
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(code)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok && !json.contractNumber) {
        throw new Error(json.reason || json.error || "Not found");
      }
      setResult(json);
      setToken(code);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const scanLoop = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => scanLoop());
      return;
    }
    const now = Date.now();
    if (now - lastScanRef.current > 250) {
      lastScanRef.current = now;
      try {
        // @ts-expect-error BarcodeDetector is not in all TS libs
        if (typeof window !== "undefined" && window.BarcodeDetector) {
          // @ts-expect-error experimental
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const codes = await detector.detect(video);
          if (codes?.length) {
            const raw = String(codes[0].rawValue || "");
            if (raw) {
              stopCamera();
              await lookup(raw);
              return;
            }
          }
        }
      } catch {
        /* keep scanning */
      }
    }
    rafRef.current = requestAnimationFrame(() => scanLoop());
  }, [lookup, stopCamera]);

  async function startCamera() {
    setCamError("");
    setErr("");
    setResult(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      // @ts-expect-error
      if (!window.BarcodeDetector) {
        setCamError(
          "Live QR decode works best in Chrome/Edge. You can still use Enter code if scan does not read."
        );
      } else {
        scanLoop();
      }
    } catch (e) {
      setCamError(
        e instanceof Error
          ? e.message
          : "Camera permission denied. Allow camera or paste the verification code."
      );
      setMode("paste");
    }
  }

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-construction-dark flex items-center gap-2">
          <QrCode className="w-7 h-7 text-primary-600" />
          Contract verification
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Scan a contract QR with the camera, or enter the short verification code. Staff see full
          payment details when signed in as admin.
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setMode("camera")}
          className={`flex-1 min-h-[40px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 ${
            mode === "camera"
              ? "bg-white text-construction-dark shadow-sm"
              : "text-slate-600"
          }`}
        >
          <Camera className="w-4 h-4" />
          Camera scan
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`flex-1 min-h-[40px] rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 ${
            mode === "paste"
              ? "bg-white text-construction-dark shadow-sm"
              : "text-slate-600"
          }`}
        >
          <Keyboard className="w-4 h-4" />
          Enter code
        </button>
      </div>

      {mode === "camera" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="relative aspect-[4/3] bg-slate-900">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <p className="text-xs text-white/90 font-medium drop-shadow">
                {scanning ? "Point at the QR code on the contract…" : "Starting camera…"}
              </p>
            </div>
          </div>
          <div className="p-3 flex flex-wrap gap-2 justify-between items-center">
            <button
              type="button"
              onClick={() => (scanning ? stopCamera() : startCamera())}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              {scanning ? (
                <>
                  <CameraOff className="w-3.5 h-3.5" /> Stop
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" /> Restart camera
                </>
              )}
            </button>
            {busy && (
              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
              </span>
            )}
          </div>
          {camError && (
            <p className="px-4 pb-3 text-xs text-amber-800 bg-amber-50 border-t border-amber-100">
              {camError}
            </p>
          )}
        </div>
      )}

      {mode === "paste" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(token);
          }}
          className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm"
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Verification code or link
          </label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste code or verification link"
            className="w-full border border-slate-200 rounded-xl px-3 min-h-[48px] text-sm"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="w-full min-h-[48px] rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Verify contract"}
          </button>
        </form>
      )}

      {err && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}

      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                result.valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}
            >
              {result.valid ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldX className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="text-lg font-bold text-construction-dark">
                {result.valid ? "Valid agreement" : "Not valid"}
              </p>
              {result.reason && <p className="text-sm text-red-600 mt-0.5">{result.reason}</p>}
              <p className="text-xs text-slate-400 mt-1">Code: {token || "—"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase text-slate-400 font-semibold">Client</dt>
              <dd className="font-medium">{result.clientName || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-slate-400 font-semibold">Contract</dt>
              <dd className="font-medium">{result.contractNumber || "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] uppercase text-slate-400 font-semibold">Service</dt>
              <dd className="font-medium">{result.service || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase text-slate-400 font-semibold">Status</dt>
              <dd className="font-medium">{result.status || "—"}</dd>
            </div>
          </dl>
          {result.extra && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-700">Staff details</p>
              <p>Payment: {result.extra.paymentMethod || "—"}</p>
              <p>Total: {result.extra.totalAmount ?? "—"}</p>
              <p>Balance: {result.extra.balance ?? "—"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
