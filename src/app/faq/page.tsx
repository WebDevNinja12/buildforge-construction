import Link from "next/link";
import { HelpCircle } from "lucide-react";

const FAQS = [
  {
    q: "How do reservations work?",
    a: "Browse Services, open full details, then reserve. Payment options appear on your Dashboard. Each category has a hold period — if you do not pay in time, the reservation is released.",
  },
  {
    q: "Can I pay in installments?",
    a: "Yes for eligible assets such as houses and land. Admin sets the schedule. You can also pay the remaining balance early from your dashboard.",
  },
  {
    q: "How do I hire tools or workers?",
    a: "Open the Tools or Workers tab on Services, preview details, reserve, then complete payment from the Dashboard.",
  },
  {
    q: "How long does account approval take?",
    a: "After you accept the rules and register, admin reviews your account. If there is no action within 12 hours, access is granted automatically; full verification still requires document review.",
  },
  {
    q: "Where do you operate?",
    a: "Hama Construction serves clients across major cities and regions. Mention your location on the quote form so we can confirm coverage.",
  },
  {
    q: "How do I get a custom project quote?",
    a: "Use Request a Quote with project type, budget, and description. Our team contacts you using the details you provide.",
  },
];

export default function FaqPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="relative text-white overflow-hidden min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/banners/workers.jpeg')" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-construction-dark/90 via-slate-900/80 to-primary-900/70" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-24 lg:py-32 w-full text-center">
          <HelpCircle className="w-12 h-12 text-accent-400 mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold drop-shadow-sm">Frequently asked questions</h1>
          <p className="mt-3 text-lg text-slate-300">Quick answers about Hama Construction services.</p>
        </div>
      </section>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group bg-slate-50 border rounded-xl p-5 open:bg-white open:shadow-sm"
          >
            <summary className="font-semibold text-construction-dark cursor-pointer list-none flex justify-between gap-4">
              {f.q}
              <span className="text-accent-500 group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-construction-gray leading-relaxed">{f.a}</p>
          </details>
        ))}
        <p className="text-center text-sm text-slate-500 pt-6">
          Still need help?{" "}
          <Link href="/contact" className="text-primary-600 font-medium">
            Contact us
          </Link>{" "}
          or{" "}
          <Link href="/quote" className="text-primary-600 font-medium">
            request a quote
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
