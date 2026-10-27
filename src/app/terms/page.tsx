import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

const rules = [
  {
    title: "Account approval",
    body: "New accounts require admin approval before full access to bookings and the user dashboard. If an admin does not review your registration within 12 hours, the system grants approval automatically.",
  },
  {
    title: "Accurate information",
    body: "You must provide truthful contact and identity details. False information may result in account suspension or removal.",
  },
  {
    title: "Reservations and payment window",
    body: "When you reserve an asset (house, land, hotel, etc.), it is removed from available listings immediately. You must complete payment of the required deposit within 24 hours. Unpaid reservations expire automatically and the asset returns to available stock.",
  },
  {
    title: "Tool and equipment hire",
    body: "Tools reserved or paid for are deducted from available inventory. Return equipment on time and in good condition. Late returns may incur extra charges.",
  },
  {
    title: "Worker and crew hire",
    body: "Hire requests are binding once accepted. Cancel according to the stated policy. Misuse of the platform or workers may lead to account restrictions.",
  },
  {
    title: "Payments",
    body: "Deposits and fees are processed through approved methods. Pending payments that are not completed within the reservation period are cancelled and inventory is released.",
  },
  {
    title: "Conduct",
    body: "Treat staff, workers, and other clients with respect. Fraud, harassment, or illegal use of the platform is prohibited and may be reported to authorities.",
  },
  {
    title: "Changes to services",
    body: "Hama Construction may update listings, pricing, and availability. Descriptions shown at booking should be reviewed carefully before you confirm.",
  },
];

export default function TermsPage() {
  return (
    <div className="bg-white min-h-screen">
      <section className="bg-gradient-to-br from-construction-dark to-primary-900 text-white py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-accent-400" />
            <h1 className="text-3xl sm:text-4xl font-bold">Platform Rules</h1>
          </div>
          <p className="text-slate-300">
            Hama Construction — Building innovation through quality and trust.
            Please read these rules carefully before creating an account.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <ol className="space-y-6">
          {rules.map((r, i) => (
            <li key={r.title} className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-construction-dark">
                <span className="text-accent-600 mr-2">{i + 1}.</span>
                {r.title}
              </h2>
              <p className="mt-2 text-sm text-construction-gray leading-relaxed">{r.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 p-6 bg-primary-50 border border-primary-100 rounded-2xl text-center">
          <p className="text-construction-dark font-medium">
            By registering you confirm that you have read and agree to these rules.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Continue to registration <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
