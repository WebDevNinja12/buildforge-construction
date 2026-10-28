import Link from "next/link";
import {
  Home,
  Building2,
  Wrench,
  Users,
  ClipboardList,
  MapPin,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import FinishedProjectsShowcase from "@/components/FinishedProjectsShowcase";

/** Your uploaded home banner (repo root). Served via raw GitHub until placed under /public. */
const HERO_BANNER =
  "https://raw.githubusercontent.com/WebDevNinja12/buildforge-construction/main/construction%20(8).png";

const features = [
  {
    icon: Building2,
    title: "Buy & Reserve Assets",
    description:
      "Browse houses, hotels, apartments and commercial properties. Reserve or purchase with clear payment options.",
    href: "/services",
  },
  {
    icon: MapPin,
    title: "Land Payments",
    description:
      "Land acquisition with full payment or structured installment plans managed on the platform.",
    href: "/services",
  },
  {
    icon: Wrench,
    title: "Tool Hiring",
    description:
      "Hire professional tools and equipment with transparent daily and weekly rates.",
    href: "/services",
  },
  {
    icon: Users,
    title: "Construction Hiring",
    description:
      "Review worker profiles — skills, experience and rates — then hire when you are ready.",
    href: "/services",
  },
  {
    icon: ClipboardList,
    title: "Project Management",
    description:
      "Track budgets, milestones and progress for your construction projects in one place.",
    href: "/services",
  },
];

export default function HomePage() {
  return (
    <div className="bg-white">
      <section className="relative text-white overflow-hidden min-h-[70vh] flex items-center">
        {/* Banner background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${HERO_BANNER}')` }}
          aria-hidden
        />
        {/* Dark overlay for readable text */}
        <div className="absolute inset-0 bg-gradient-to-r from-construction-dark/90 via-slate-900/75 to-primary-900/60" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-accent-500/25 text-accent-200 text-sm font-medium px-3 py-1 rounded-full mb-6 border border-accent-500/30">
              <Home className="w-4 h-4" />
              Hama Construction
            </div>
            <p className="text-accent-400 font-medium tracking-wide uppercase text-sm sm:text-base mb-4">
              Building innovation through quality and trust
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight drop-shadow-sm">
              Build Smarter.{" "}
              <span className="text-accent-400">Manage Everything.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-200 leading-relaxed max-w-2xl">
              Buy or reserve houses, hotels and land. Hire tools and skilled
              workers. Manage construction work from inquiry to completion —
              on one platform.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-accent-500/25"
              >
                Explore Services
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors border border-white/20 backdrop-blur-sm"
              >
                Finished Projects
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-construction-dark">
              Everything You Need to Build
            </h2>
            <p className="mt-4 text-lg text-construction-gray">
              From land acquisition to hiring crews — manage assets, tools,
              labour and projects on a single platform.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg hover:border-primary-200 transition-all"
              >
                <div className="w-12 h-12 bg-primary-100 group-hover:bg-primary-600 rounded-xl flex items-center justify-center transition-colors">
                  <feature.icon className="w-6 h-6 text-primary-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-construction-dark group-hover:text-primary-700 transition-colors">
                  {feature.title}
                </h3>
                <p className="mt-2 text-construction-gray leading-relaxed">{feature.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-600 group-hover:gap-2 transition-all">
                  Go to services <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-construction-dark">
              Recent Finished Projects
            </h2>
            <p className="mt-4 text-lg text-construction-gray">
              Completed work published by Hama Construction. Listings appear here when added in Admin.
            </p>
          </div>
          <FinishedProjectsShowcase />
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-construction-dark">Why Choose Hama Construction?</h2>
              <p className="mt-4 text-lg text-accent-600 font-medium italic">
                Building innovation through quality and trust.
              </p>
              <p className="mt-3 text-lg text-construction-gray">
                We combine construction expertise with a clear digital process so you can focus on building.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Secure reservations with full or installment payment options",
                  "Verified listings for assets, tools and workers",
                  "Clear timelines, countdowns and payment status",
                  "Admin review of payments and customer verification",
                  "Support from inquiry through project delivery",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-accent-500 shrink-0 mt-0.5" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/about" className="mt-8 inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700">
                About our company <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={HERO_BANNER}
                alt="Hama Construction project site"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-primary-700 to-primary-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-accent-300 font-medium tracking-wide uppercase text-sm mb-3">
            Building innovation through quality and trust
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to Start Your Next Project?</h2>
          <p className="mt-4 text-lg text-primary-100">
            Register for an account to browse services, reserve assets, and manage your work with Hama Construction.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors">
              Create Account
            </Link>
            <Link href="/services" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl border border-white/20 transition-colors">
              View Services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
