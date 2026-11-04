"use client";

import { useState } from "react";
import { KeyRound, Shield, Mail, Loader2, Trash2 } from "lucide-react";

export default function AdminSettingsPage() {
  const [ownMsg, setOwnMsg] = useState("");
  const [ownErr, setOwnErr] = useState("");
  const [ownBusy, setOwnBusy] = useState(false);
  const [own, setOwn] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [userMsg, setUserMsg] = useState("");
  const [userErr, setUserErr] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", newPassword: "" });
  const [resetLink, setResetLink] = useState("");

  const [linkMsg, setLinkMsg] = useState("");
  const [linkErr, setLinkErr] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");

  const [purgeMsg, setPurgeMsg] = useState("");
  const [purgeErr, setPurgeErr] = useState("");
  const [purgeBusy, setPurgeBusy] = useState(false);

  async function changeOwn(e: React.FormEvent) {
    e.preventDefault();
    setOwnMsg("");
    setOwnErr("");
    setOwnBusy(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_own", ...own }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setOwnMsg(data.message || "Password updated");
      setOwn({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setOwnErr(err instanceof Error ? err.message : "Failed");
    } finally {
      setOwnBusy(false);
    }
  }

  async function setUserPassword(e: React.FormEvent) {
    e.preventDefault();
    setUserMsg("");
    setUserErr("");
    setUserBusy(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_user",
          email: userForm.email,
          newPassword: userForm.newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setUserMsg(data.message || "Password set");
      setUserForm({ email: userForm.email, newPassword: "" });
    } catch (err) {
      setUserErr(err instanceof Error ? err.message : "Failed");
    } finally {
      setUserBusy(false);
    }
  }

  async function sendResetLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkMsg("");
    setLinkErr("");
    setResetLink("");
    setLinkBusy(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reset", email: linkEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setLinkMsg(data.message || "Reset link created");
      if (data.resetUrl) setResetLink(data.resetUrl);
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : "Failed");
    } finally {
      setLinkBusy(false);
    }
  }

  async function purgeCatalog() {
    if (
      !confirm(
        "Delete ALL services, tools, workers, and related reservations/payments? Only keep real users/admin. This cannot be undone."
      )
    )
      return;
    const typed = window.prompt('Type CLEAR CATALOG to confirm');
    if (typed !== "CLEAR CATALOG") {
      alert("Cancelled");
      return;
    }
    setPurgeBusy(true);
    setPurgeMsg("");
    setPurgeErr("");
    try {
      const res = await fetch("/api/admin/purge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "CLEAR CATALOG" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Purge failed");
      setPurgeMsg(
        data.message +
          (data.counts
            ? ` Removed: ${JSON.stringify(data.counts)}`
            : "")
      );
    } catch (e) {
      setPurgeErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setPurgeBusy(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-construction-dark">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Password security and data cleanup. Listings must be real — add them under Services, Tools, and
          Workers.
        </p>
      </div>

      <section className="bg-white border rounded-2xl p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-construction-dark flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary-600" />
          Change my admin password
        </h2>
        <form onSubmit={changeOwn} className="space-y-3">
          <input
            type="password"
            autoComplete="current-password"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="Current password"
            value={own.currentPassword}
            onChange={(e) => setOwn({ ...own, currentPassword: e.target.value })}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="New password (min 8 characters)"
            value={own.newPassword}
            onChange={(e) => setOwn({ ...own, newPassword: e.target.value })}
            required
            minLength={8}
          />
          <input
            type="password"
            autoComplete="new-password"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="Confirm new password"
            value={own.confirmPassword}
            onChange={(e) => setOwn({ ...own, confirmPassword: e.target.value })}
            required
            minLength={8}
          />
          <button
            type="submit"
            disabled={ownBusy}
            className="min-h-[44px] px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {ownBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Update my password
          </button>
          {ownMsg && <p className="text-sm text-emerald-700">{ownMsg}</p>}
          {ownErr && <p className="text-sm text-red-600">{ownErr}</p>}
        </form>
      </section>

      <section className="bg-white border rounded-2xl p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-construction-dark flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary-600" />
          Set a client password
        </h2>
        <form onSubmit={setUserPassword} className="space-y-3">
          <input
            type="email"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="Client email"
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            required
          />
          <input
            type="password"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="New password (min 8 characters)"
            value={userForm.newPassword}
            onChange={(e) => setUserForm({ ...userForm, newPassword: e.target.value })}
            required
            minLength={8}
          />
          <button
            type="submit"
            disabled={userBusy}
            className="min-h-[44px] px-4 rounded-xl bg-construction-dark text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {userBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Set password
          </button>
          {userMsg && <p className="text-sm text-emerald-700">{userMsg}</p>}
          {userErr && <p className="text-sm text-red-600">{userErr}</p>}
        </form>
      </section>

      <section className="bg-white border rounded-2xl p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-construction-dark flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary-600" />
          Send password reset link
        </h2>
        <form onSubmit={sendResetLink} className="space-y-3">
          <input
            type="email"
            className="w-full border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="Client email"
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={linkBusy}
            className="min-h-[44px] px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
          >
            {linkBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Generate / send link
          </button>
          {linkMsg && <p className="text-sm text-emerald-700">{linkMsg}</p>}
          {linkErr && <p className="text-sm text-red-600">{linkErr}</p>}
          {resetLink && (
            <div className="bg-slate-50 border rounded-xl p-3 text-xs break-all">
              <p className="font-semibold mb-1">Reset link</p>
              <a href={resetLink} className="text-primary-600 underline" target="_blank" rel="noreferrer">
                {resetLink}
              </a>
            </div>
          )}
        </form>
      </section>

      <section className="bg-red-50 border border-red-100 rounded-2xl p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-red-800 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Remove demo / sample catalog
        </h2>
        <p className="text-sm text-red-900/80">
          Deletes all services, tools, workers, reservations, and payments so the site only shows what you add
          for real. Your admin login is kept.
        </p>
        <button
          type="button"
          disabled={purgeBusy}
          onClick={purgeCatalog}
          className="min-h-[44px] px-4 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {purgeBusy && <Loader2 className="w-4 h-4 animate-spin" />}
          Clear all listings & transactions
        </button>
        {purgeMsg && <p className="text-sm text-emerald-800">{purgeMsg}</p>}
        {purgeErr && <p className="text-sm text-red-700">{purgeErr}</p>}
      </section>
    </div>
  );
}
