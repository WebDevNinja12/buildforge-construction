"use client";

import { useEffect, useState } from "react";
import {
  KeyRound,
  Shield,
  Mail,
  Loader2,
  Trash2,
  Lock,
  Unlock,
  Settings2,
} from "lucide-react";

function Card({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-50/80 border-amber-200"
      : tone === "danger"
        ? "bg-red-50/80 border-red-100"
        : "bg-white border-slate-200/80";
  return (
    <section className={`border rounded-2xl shadow-sm overflow-hidden ${toneClass}`}>
      {children}
    </section>
  );
}

function CardHead({
  icon: Icon,
  title,
  subtitle,
  iconClass = "text-primary-600",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  iconClass?: string;
}) {
  return (
    <div className="px-5 pt-5 pb-3 border-b border-slate-100/80">
      <h2 className="font-semibold text-construction-dark flex items-center gap-2 text-[15px]">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 ${iconClass}`}
        >
          <Icon className="w-4 h-4" />
        </span>
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

const inputClass =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm min-h-[46px] bg-white text-construction-dark placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 transition";

export default function AdminSettingsPage() {
  const [maint, setMaint] = useState({
    maintenanceMode: false,
    lockClientLogin: false,
    lockRegistration: false,
    message: "",
  });
  const [maintBusy, setMaintBusy] = useState(false);
  const [maintMsg, setMaintMsg] = useState("");
  const [maintErr, setMaintErr] = useState("");
  const [maintLoading, setMaintLoading] = useState(true);

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/site-mode", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setMaint({
            maintenanceMode: Boolean(data.maintenanceMode),
            lockClientLogin: Boolean(data.lockClientLogin),
            lockRegistration: Boolean(data.lockRegistration),
            message: String(data.message || ""),
          });
        }
      } catch {
        /* */
      } finally {
        setMaintLoading(false);
      }
    })();
  }, []);

  async function saveSiteMode(patch: Partial<typeof maint>) {
    setMaintBusy(true);
    setMaintMsg("");
    setMaintErr("");
    try {
      const next = { ...maint, ...patch };
      const res = await fetch("/api/admin/site-mode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setMaint({
        maintenanceMode: Boolean(data.maintenanceMode),
        lockClientLogin: Boolean(data.lockClientLogin),
        lockRegistration: Boolean(data.lockRegistration),
        message: String(data.message || next.message || ""),
      });
      setMaintMsg(
        data.message ||
          (data.maintenanceMode
            ? "Maintenance ON — client login/register locked."
            : "Site access updated.")
      );
    } catch (e) {
      setMaintErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setMaintBusy(false);
    }
  }

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
      else if (data.link || data.resetLink || data.url) {
        setResetLink(data.link || data.resetLink || data.url);
      }
    } catch (err) {
      setLinkErr(err instanceof Error ? err.message : "Failed");
    } finally {
      setLinkBusy(false);
    }
  }

  async function purgeCatalog() {
    if (
      !confirm(
        "Delete ALL demo services, tools, workers, and reservations? Payment history is kept. Admin login is kept. This cannot be undone."
      )
    )
      return;
    const typed = window.prompt("Type CLEAR CATALOG to confirm");
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
          (data.counts ? ` Removed: ${JSON.stringify(data.counts)}` : "")
      );
    } catch (e) {
      setPurgeErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setPurgeBusy(false);
    }
  }

  const locked =
    maint.maintenanceMode || maint.lockClientLogin || maint.lockRegistration;

  return (
    <div className="space-y-6 max-w-2xl pb-10">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
          <Settings2 className="w-3.5 h-3.5 text-primary-600" />
          Admin
        </div>
        <h1 className="text-2xl font-bold text-construction-dark tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Maintenance lock, password security, and data cleanup. Admin login always works even when
          the site is locked.
        </p>
      </div>

      <Card tone={locked ? "warn" : "default"}>
        <CardHead
          icon={locked ? Lock : Unlock}
          title="Site maintenance"
          subtitle="When locked, clients cannot log in or create accounts. Admin login is never blocked."
          iconClass={locked ? "text-amber-700" : "text-emerald-600"}
        />
        <div className="px-5 py-4 space-y-4">
          {maintLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={maintBusy}
                  onClick={() =>
                    saveSiteMode({
                      maintenanceMode: true,
                      lockClientLogin: true,
                      lockRegistration: true,
                    })
                  }
                  className="min-h-[44px] px-4 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2 shadow-sm transition"
                >
                  {maintBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Lock site
                </button>
                <button
                  type="button"
                  disabled={maintBusy}
                  onClick={() =>
                    saveSiteMode({
                      maintenanceMode: false,
                      lockClientLogin: false,
                      lockRegistration: false,
                    })
                  }
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2 shadow-sm transition"
                >
                  <Unlock className="w-4 h-4" />
                  Unlock site
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-sm cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={maint.lockClientLogin}
                    disabled={maintBusy}
                    onChange={(e) => saveSiteMode({ lockClientLogin: e.target.checked })}
                  />
                  Block client login
                </label>
                <label className="flex items-center gap-2.5 min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-white text-sm cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={maint.lockRegistration}
                    disabled={maintBusy}
                    onChange={(e) => saveSiteMode({ lockRegistration: e.target.checked })}
                  />
                  Block new registration
                </label>
              </div>

              <Field label="Message shown to users">
                <textarea
                  rows={3}
                  className={`${inputClass} resize-y min-h-[88px]`}
                  value={maint.message}
                  onChange={(e) => setMaint((m) => ({ ...m, message: e.target.value }))}
                  placeholder="Maintenance message…"
                />
              </Field>
              <button
                type="button"
                disabled={maintBusy}
                onClick={() => saveSiteMode({ message: maint.message })}
                className="min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Save message
              </button>

              <p className="text-xs text-slate-500">
                Status:{" "}
                <span className={`font-semibold ${locked ? "text-amber-700" : "text-emerald-600"}`}>
                  {locked ? "Locked / maintenance" : "Open"}
                </span>
              </p>
              {maintMsg && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                  {maintMsg}
                </p>
              )}
              {maintErr && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {maintErr}
                </p>
              )}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHead
          icon={KeyRound}
          title="Change my admin password"
          subtitle="Update the password for the account you are signed in with."
        />
        <form onSubmit={changeOwn} className="px-5 py-4 space-y-3">
          <Field>
            <input
              type="password"
              autoComplete="current-password"
              className={inputClass}
              placeholder="Current password"
              value={own.currentPassword}
              onChange={(e) => setOwn({ ...own, currentPassword: e.target.value })}
              required
            />
          </Field>
          <Field>
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              placeholder="New password (min 8 characters)"
              value={own.newPassword}
              onChange={(e) => setOwn({ ...own, newPassword: e.target.value })}
              required
              minLength={8}
            />
          </Field>
          <Field>
            <input
              type="password"
              autoComplete="new-password"
              className={inputClass}
              placeholder="Confirm new password"
              value={own.confirmPassword}
              onChange={(e) => setOwn({ ...own, confirmPassword: e.target.value })}
              required
              minLength={8}
            />
          </Field>
          <button
            type="submit"
            disabled={ownBusy}
            className="min-h-[44px] px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2 shadow-sm transition"
          >
            {ownBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Update my password
          </button>
          {ownMsg && <p className="text-sm text-emerald-700">{ownMsg}</p>}
          {ownErr && <p className="text-sm text-red-600">{ownErr}</p>}
        </form>
      </Card>

      <Card>
        <CardHead
          icon={Shield}
          title="Set a client password"
          subtitle="Directly set a new password for a client by email."
        />
        <form onSubmit={setUserPassword} className="px-5 py-4 space-y-3">
          <Field label="Client email">
            <input
              type="email"
              className={inputClass}
              placeholder="client@email.com"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              required
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              className={inputClass}
              placeholder="New password"
              value={userForm.newPassword}
              onChange={(e) => setUserForm({ ...userForm, newPassword: e.target.value })}
              required
              minLength={8}
            />
          </Field>
          <button
            type="submit"
            disabled={userBusy}
            className="min-h-[44px] px-4 rounded-xl bg-construction-dark hover:bg-slate-800 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2 shadow-sm transition"
          >
            {userBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Set password
          </button>
          {userMsg && <p className="text-sm text-emerald-700">{userMsg}</p>}
          {userErr && <p className="text-sm text-red-600">{userErr}</p>}
        </form>
      </Card>

      <Card>
        <CardHead
          icon={Mail}
          title="Send password reset link"
          subtitle="Generate a one-time reset link for a client account."
        />
        <form onSubmit={sendResetLink} className="px-5 py-4 space-y-3">
          <Field label="Client email">
            <input
              type="email"
              className={inputClass}
              placeholder="Client email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              required
            />
          </Field>
          <button
            type="submit"
            disabled={linkBusy}
            className="min-h-[44px] px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2 shadow-sm transition"
          >
            {linkBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Generate / send link
          </button>
          {linkMsg && <p className="text-sm text-emerald-700">{linkMsg}</p>}
          {linkErr && <p className="text-sm text-red-600">{linkErr}</p>}
          {resetLink && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs break-all">
              <p className="font-semibold text-slate-700 mb-1">Reset link</p>
              <a
                href={resetLink}
                className="text-primary-600 underline"
                target="_blank"
                rel="noreferrer"
              >
                {resetLink}
              </a>
            </div>
          )}
        </form>
      </Card>

      <Card tone="danger">
        <CardHead
          icon={Trash2}
          title="Remove demo / sample catalog"
          subtitle="Deletes demo services, tools, workers, and reservations. Payment records and your admin login are kept."
          iconClass="text-red-600"
        />
        <div className="px-5 py-4 space-y-3">
          <button
            type="button"
            disabled={purgeBusy}
            onClick={purgeCatalog}
            className="min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2 shadow-sm transition"
          >
            {purgeBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            Clear demo listings (keep payments)
          </button>
          {purgeMsg && <p className="text-sm text-emerald-800">{purgeMsg}</p>}
          {purgeErr && <p className="text-sm text-red-700">{purgeErr}</p>}
        </div>
      </Card>
    </div>
  );
}
