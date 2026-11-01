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
  Shield,
  Award,
  Phone,
} from "lucide-react";
import FinishedProjectsShowcase from "@/components/FinishedProjectsShowcase";
import { Testimonials } from "@/components/Testimonials";

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
      "Open a project deal from your dashboard. Admin reviews and connects with you directly.",
    href: "/quote",
  },
];

const trust = [
  { icon: Shield, label: "Verified process", text: "Document review & secure accounts" },
  { icon: Award, label: "Quality & trust", text: "Building innovation through quality and trust" },
  { icon: CheckCircle2, label: "Transparent payments", text: "Full or installment options" },
  { icon: MapPin, label: "Service areas", text: "Major cities & project locations" },
];

export default function HomePage() {
  return (
    <div className="bg-white">
      <section className="relative text-white overflow-hidden min-h-[70vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${HERO_BANNER}')` }}
          aria-hidden
        />
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
              Buy or reserve houses, hotels and land. Hire tools and skilled workers. Get a project
              quote — on one platform.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/quote"
                className="inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-accent-500/25"
              >
                Request a Quote
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors border border-white/20 backdrop-blur-sm"
              >
                Explore Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {trust.map((t) => (
            <div key={t.label} className="flex gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                <t.icon className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-construction-dark">{t.label}</p>
                <p className="text-sm text-construction-gray">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-construction-dark">What we offer</h2>
            <p className="mt-4 text-lg text-construction-gray">
              Assets, land, tools, labour and project support — designed for modern construction.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  Learn more <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-construction-dark">
              Recent Finished Projects
            </h2>
            <p className="mt-4 text-lg text-construction-gray">
              Completed work published by Hama Construction.
            </p>
          </div>
          <FinishedProjectsShowcase />
          <div className="text-center mt-10">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 text-primary-700 font-semibold hover:gap-3 transition-all"
            >
              View all projects <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Testimonials />

      <section className="py-16 bg-primary-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to start your project?</h2>
          <p className="mt-3 text-primary-100">
            Request a quote or talk to our team — we respond promptly.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/quote"
              className="inline-flex justify-center items-center gap-2 bg-accent-500 hover:bg-accent-600 font-semibold px-8 py-3.5 rounded-xl"
            >
              Get a Quote
            </Link>
            <Link
              href="/contact"
              className="inline-flex justify-center items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 font-semibold px-8 py-3.5 rounded-xl"
            >
              <Phone className="w-4 h-4" /> Contact
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
