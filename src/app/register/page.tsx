"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HardHat,
  UserPlus,
  FileText,
  CheckCircle2,
  Eye,
  EyeOff,
  User,
  Building2,
} from "lucide-react";

const RULES_SUMMARY = [
  "Admin must approve new accounts; auto-approval after 12 hours if not reviewed.",
  "Provide accurate personal or company information and valid supporting documents.",
  "Reservations are time-limited; pay before the hold expires or the listing is released.",
  "Fraud or false documents may lead to account suspension.",
  "Only the account holder (or authorized company contact) may manage bookings and payments.",
];

type AccountType = "INDIVIDUAL" | "COMPANY";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"rules" | "type" | "form">("rules");
  const [agreed, setAgreed] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("INDIVIDUAL");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    nin: "",
    bvn: "",
    password: "",
    confirm: "",
  });

  const [co, setCo] = useState({
    companyName: "",
    companyRc: "",
    companyTin: "",
    companyEmail: "",
    companyPhone: "",
    companyAddress: "",
    password: "",
    confirm: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    directorName: "",
    directorNin: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("You must agree to the platform rules");
      return;
    }
    setLoading(true);
    try {
      let payload: Record<string, unknown>;
      if (accountType === "INDIVIDUAL") {
        const name = form.name.trim();
        const email = form.email.trim();
        const phone = form.phone.trim();
        const address = form.address.trim();
        const nin = form.nin.trim().replace(/\D/g, "");
        const bvn = form.bvn.trim().replace(/\D/g, "");
        if (!name || !email || !phone || !address || !nin) {
          throw new Error("Full name, email, phone, address and NIN are required");
        }
        if (nin.length !== 11) throw new Error("NIN must be exactly 11 digits");
        if (bvn && bvn.length !== 11) throw new Error("BVN must be exactly 11 digits");
        if (form.password.length < 6) throw new Error("Password must be at least 6 characters");
        if (form.password !== form.confirm) throw new Error("Passwords do not match");
        payload = {
          clientType: "INDIVIDUAL",
          name,
          email,
          phone,
          address,
          nin,
          bvn: bvn || undefined,
          password: form.password,
          agreedTerms: true,
          documents: [],
        };
      } else {
        const companyName = co.companyName.trim();
        const companyRc = co.companyRc.trim();
        const companyTin = co.companyTin.trim();
        const companyEmail = co.companyEmail.trim();
        const companyPhone = co.companyPhone.trim();
        const companyAddress = co.companyAddress.trim();
        if (!companyName || !companyRc || !companyTin || !companyEmail || !companyPhone || !companyAddress) {
          throw new Error("Company name, RC/CAC, TIN, email, phone and address are required");
        }
        if (!co.contactName.trim() || !co.contactPhone.trim()) {
          throw new Error("Contact person name and phone are required");
        }
        if (!co.directorName.trim()) throw new Error("Add at least one director name");
        if (co.password.length < 6) throw new Error("Password must be at least 6 characters");
        if (co.password !== co.confirm) throw new Error("Passwords do not match");
        payload = {
          clientType: "COMPANY",
          companyName,
          companyRc,
          companyTin,
          companyEmail,
          companyPhone,
          companyAddress,
          password: co.password,
          agreedTerms: true,
          contactPerson: {
            name: co.contactName.trim(),
            phone: co.contactPhone.trim(),
            email: co.contactEmail.trim(),
          },
          directors: [
            {
              name: co.directorName.trim(),
              nin: co.directorNin.trim().replace(/\D/g, "") || undefined,
            },
          ],
          documents: [],
        };
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Registration failed");
      router.push("/pending-approval");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (step === "rules") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-slate-50">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-xl mb-4">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-construction-dark">Platform Rules</h1>
            <p className="mt-2 text-sm text-construction-gray">
              Read and agree before creating your Hama Construction account.
            </p>
          </div>
          <ul className="space-y-3 mb-6">
            {RULES_SUMMARY.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <Link href="/terms" className="text-sm text-primary-600 hover:underline">
            Read full rules →
          </Link>
          <label className="mt-6 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">
              I have read and agree to the Hama Construction platform rules and terms.
            </span>
          </label>
          <button
            type="button"
            disabled={!agreed}
            onClick={() => setStep("type")}
            className="mt-6 w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Agree & continue
          </button>
          <p className="mt-4 text-center text-sm text-construction-gray">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (step === "type") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-slate-50">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-bold text-construction-dark text-center mb-2">Account type</h1>
          <p className="text-sm text-slate-500 text-center mb-6">Choose how you will use Hama Construction</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setAccountType("INDIVIDUAL");
                setStep("form");
              }}
              className="min-h-[120px] bg-white border-2 border-slate-200 hover:border-accent-500 rounded-2xl p-5 text-left transition shadow-sm"
            >
              <User className="w-8 h-8 text-accent-500 mb-3" />
              <p className="font-bold text-construction-dark">Individual</p>
              <p className="text-xs text-slate-500 mt-1">Personal account — NIN, address & ID</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType("COMPANY");
                setStep("form");
              }}
              className="min-h-[120px] bg-white border-2 border-slate-200 hover:border-primary-500 rounded-2xl p-5 text-left transition shadow-sm"
            >
              <Building2 className="w-8 h-8 text-primary-600 mb-3" />
              <p className="font-bold text-construction-dark">Company</p>
              <p className="text-xs text-slate-500 mt-1">Business — CAC, TIN & directors</p>
            </button>
          </div>
          <button type="button" onClick={() => setStep("rules")} className="mt-6 w-full text-sm text-slate-500 underline">
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-500 rounded-xl mb-4">
            <HardHat className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-construction-dark">
            {accountType === "COMPANY" ? "Company registration" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {accountType === "COMPANY" ? "Company" : "Individual"} ·{" "}
            <button type="button" className="text-primary-600 underline" onClick={() => setStep("type")}>
              change type
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {accountType === "INDIVIDUAL" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone *</label>
                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="08012345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Address *</label>
                <input type="text" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Street, city, state" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">NIN (11 digits) *</label>
                <input type="text" required inputMode="numeric" maxLength={11} value={form.nin}
                  onChange={(e) => setForm({ ...form, nin: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="12345678901" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">BVN (optional)</label>
                <input type="text" inputMode="numeric" maxLength={11} value={form.bvn}
                  onChange={(e) => setForm({ ...form, bvn: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="11 digits" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required minLength={6} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-2.5 pr-11 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <input type={showConfirm ? "text" : "password"} required value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    className="w-full px-4 py-2.5 pr-11 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {accountType === "COMPANY" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Company name *</label>
                <input required value={co.companyName} onChange={(e) => setCo({ ...co, companyName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">RC / CAC *</label>
                  <input required value={co.companyRc} onChange={(e) => setCo({ ...co, companyRc: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="RC123456" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">TIN *</label>
                  <input required value={co.companyTin} onChange={(e) => setCo({ ...co, companyTin: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Company email *</label>
                <input type="email" required value={co.companyEmail} onChange={(e) => setCo({ ...co, companyEmail: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Company phone *</label>
                <input type="tel" required value={co.companyPhone} onChange={(e) => setCo({ ...co, companyPhone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Company address *</label>
                <input required value={co.companyAddress} onChange={(e) => setCo({ ...co, companyAddress: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div className="border-t pt-3">
                <p className="text-sm font-semibold text-construction-dark mb-2">Contact person</p>
                <input required placeholder="Full name *" value={co.contactName} onChange={(e) => setCo({ ...co, contactName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 mb-2 outline-none" />
                <input required placeholder="Phone *" value={co.contactPhone} onChange={(e) => setCo({ ...co, contactPhone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 mb-2 outline-none" />
                <input type="email" placeholder="Email" value={co.contactEmail} onChange={(e) => setCo({ ...co, contactEmail: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 outline-none" />
              </div>
              <div className="border-t pt-3">
                <p className="text-sm font-semibold text-construction-dark mb-2">Director (at least one)</p>
                <input required placeholder="Director full name *" value={co.directorName} onChange={(e) => setCo({ ...co, directorName: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 mb-2 outline-none" />
                <input placeholder="Director NIN (optional)" value={co.directorNin}
                  onChange={(e) => setCo({ ...co, directorNin: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
                <input type={showPassword ? "text" : "password"} required minLength={6} value={co.password}
                  onChange={(e) => setCo({ ...co, password: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password *</label>
                <input type={showConfirm ? "text" : "password"} required value={co.confirm}
                  onChange={(e) => setCo({ ...co, confirm: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 outline-none" />
              </div>
            </>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors mt-2">
            {loading ? "Creating account..." : (<><UserPlus className="w-4 h-4" /> Create Account</>)}
          </button>
          <button type="button" onClick={() => setStep("type")} className="w-full text-sm text-slate-500 hover:text-slate-700">
            ← Back
          </button>
        </form>
      </div>
    </div>
  );
}
