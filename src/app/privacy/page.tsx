import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Hama Construction",
  description: "How Hama Construction collects, uses, and protects your data.",
};

const sections = [
  {
    title: "Who we are",
    body: "Hama Construction / HAMA ENTERPRISE NG operates this website and client portal to offer property, equipment, and construction-related services in Nigeria.",
  },
  {
    title: "Information we collect",
    body: "Account details (name, email, phone, address, NIN where provided), identity documents you upload for verification, booking and payment records, project quotes, and technical logs needed to secure the service.",
  },
  {
    title: "How we use information",
    body: "To create and manage your account, process reservations and bank-transfer payments, verify identity, issue contracts, prevent fraud, improve the platform, and contact you about bookings or legal notices.",
  },
  {
    title: "Payments",
    body: "Settlement is by bank transfer to our published Opay account. We record payment references and amounts; we do not store full card numbers on this platform.",
  },
  {
    title: "Sharing",
    body: "We do not sell your personal data. We may share limited data with infrastructure providers under contract, or when required by law or to protect rights and safety.",
  },
  {
    title: "Retention",
    body: "Account, booking, payment, and contract records are kept as long as needed for operations, accounting, and legal obligations.",
  },
  {
    title: "Security",
    body: "We use HTTPS, access controls, and secure storage for documents. Use a strong unique password.",
  },
  {
    title: "Your choices",
    body: "Update profile details in the client portal, or request correction/closure via Contact. Some records may be retained where the law requires.",
  },
  {
    title: "Contact",
    body: "For privacy requests, use the Contact page or the email published on the site.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-construction-dark text-white">
        <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Legal</p>
          <h1 className="text-3xl font-bold mt-2 flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary-300" />
            Privacy Policy
          </h1>
          <p className="text-slate-300 mt-3 text-sm max-w-xl">
            Last updated November 2026. This policy explains how we handle personal data on the Hama Construction platform.
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {sections.map((s) => (
          <section key={s.title} className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-construction-dark">{s.title}</h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{s.body}</p>
          </section>
        ))}
        <p className="text-sm text-slate-500">
          See also our{" "}
          <Link href="/terms" className="text-primary-700 font-semibold hover:underline">
            Terms of use
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
