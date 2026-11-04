"use client";

import { useState } from "react";
import { KeyRound, Shield, Mail, Loader2 } from "lucide-react";

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

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-construction-dark">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Password security and platform defaults. NIN is collected only on installment documents, not at login.
        </p>
      </div>

      {/* Change own password */}
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

      {/* Set user password */}
      <section className="bg-white border rounded-2xl p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-construction-dark flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary-600" />
          Set a client password
        </h2>
        <p className="text-xs text-slate-500">
          Directly set a new password for a registered client (or another admin). Share it with them securely.
        </p>
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

      {/* Send reset link */}
      <section className="bg-white border rounded-2xl p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-construction-dark flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary-600" />
          Send password reset link
        </h2>
        <p className="text-xs text-slate-500">
          Creates a one-hour reset link. If email (Resend) is configured, the client is emailed; otherwise the
          link is shown here for you to copy.
        </p>
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
              <p className="font-semibold mb-1">Reset link (copy and share securely)</p>
              <a href={resetLink} className="text-primary-600 underline" target="_blank" rel="noreferrer">
                {resetLink}
              </a>
            </div>
          )}
        </form>
        <p className="text-xs text-slate-500">
          Clients can also use the public page:{" "}
          <a href="/forgot-password" className="text-primary-600 underline" target="_blank" rel="noreferrer">
            /forgot-password
          </a>
        </p>
      </section>

      <section className="bg-slate-50 border rounded-2xl p-4 text-sm text-slate-600 space-y-2">
        <p className="font-semibold text-construction-dark">Platform defaults (reference)</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>House hold default: 14 days</li>
          <li>Hotel: 7 days · Land: 5 days · Tools: 48h · Workers: 12h</li>
          <li>Installment documents load from RequiredDocumentType / built-in defaults</li>
        </ul>
      </section>
    </div>
  );
}
