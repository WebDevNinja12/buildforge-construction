"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function AdminScanPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    const t = token.trim();
    if (!t) return;
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      // Accept full URL or raw token
      const m = t.match(/\/verify\/([a-f0-9]+)/i);
      const code = m ? m[1] : t;
      const res = await fetch(`/api/verify/${code}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok && !json.contractNumber) throw new Error(json.reason || json.error || "Not found");
      setResult(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Scan / verify QR</h1>
      <p className="text-sm text-slate-500">
        Paste the verification URL or token from a scanned QR code. On mobile, use your camera app to
        open the QR, then paste the link here for staff-level details.
      </p>
      <form onSubmit={lookup} className="space-y-3">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="https://…/verify/… or token"
          className="w-full border rounded-xl px-3 min-h-[44px] text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[48px] rounded-xl bg-primary-600 text-white font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Verify"}
        </button>
      </form>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {result && (
        <div className="bg-white border rounded-2xl p-4 text-sm space-y-1">
          <p className="font-bold">{result.valid ? "Valid" : "Not valid"}</p>
          <p>{result.clientName}</p>
          <p>{result.contractNumber}</p>
          <p>{result.service}</p>
          <p>Status: {result.status}</p>
          {result.extra && (
            <div className="mt-2 text-xs bg-slate-50 rounded-lg p-2">
              <p>Payment: {result.extra.paymentMethod}</p>
              <p>Balance: {result.extra.balance}</p>
              {result.extra.userId && (
                <Link href={`/admin/clients/${result.extra.userId}`} className="text-primary-600 font-semibold">
                  Open client profile →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
