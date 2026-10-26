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
  Star,
} from "lucide-react";
import FinishedProjectsShowcase from "@/components/FinishedProjectsShowcase";

const features = [
  {
    icon: Building2,
    title: "Buy & Reserve Assets",
    description:
      "Browse houses, hotels, apartments and commercial properties. Reserve or purchase with secure payments.",
    href: "/services#assets",
  },
  {
    icon: MapPin,
    title: "Land Payments",
    description:
      "Flexible land acquisition and installment payment plans tailored to your budget and timeline.",
    href: "/services#land",
  },
  {
    icon: Wrench,
    title: "Tool Hiring",
    description:
      "Rent professional power tools, hand tools and heavy equipment by the day or week.",
    href: "/services#tools",
  },
  {
    icon: Users,
    title: "Construction Hiring",
    description:
      "Hire skilled masons, electricians, plumbers, carpenters and full crews for your projects.",
    href: "/services#workers",
  },
  {
    icon: ClipboardList,
    title: "Project Management",
    description:
      "Track budgets, milestones, progress and payments for all your construction projects in one place.",
    href: "/services#projects",
  },
];

const stats = [
  { value: "500+", label: "Projects Completed" },
  { value: "1,200+", label: "Happy Clients" },
  { value: "80+", label: "Skilled Workers" },
  { value: "15+", label: "Years Experience" },
];

const testimonials = [
  {
    name: "James Okonkwo",
    role: "Property Developer",
    text: "Hama Construction made acquiring our hotel site and managing the entire build seamless. Highly recommended.",
    rating: 5,
  },
  {
    name: "Sarah Chen",
    role: "Homeowner",
    text: "From land payment to hiring the crew and tracking progress — everything in one platform. Excellent service.",
    rating: 5,
  },
  {
    name: "Michael Torres",
    role: "Contractor",
    text: "The tool rental and worker hiring features save us hours every week. Reliable and professional.",
    rating: 5,
  },
];

export default function HomePage() {
  return (
    <div className="bg-white">
      <section className="relative bg-gradient-to-br from-construction-dark via-slate-800 to-primary-900 text-white overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-accent-500/20 text-accent-300 text-sm font-medium px-3 py-1 rounded-full mb-6">
              <Home className="w-4 h-4" />
              Hama Construction
            </div>
            <p className="text-accent-400 font-medium tracking-wide uppercase text-sm sm:text-base mb-4">
              Building innovation through quality and trust
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Build Smarter.{" "}
              <span className="text-accent-400">Manage Everything.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl">
              Buy or reserve houses, hotels and land. Hire tools and skilled
              workers. Manage your construction projects from start to finish —
              all in one place.
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
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors border border-white/20"
              >
                Finished Projects
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl sm:text-4xl font-bold">{stat.value}</div>
                <div className="mt-1 text-primary-100 text-sm sm:text-base">{stat.label}</div>
              </div>
            ))}
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
              From land acquisition to the final nail — manage assets, tools,
              labor and projects on a single platform.
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
                  Learn more <ArrowRight className="w-4 h-4" />
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
              A selection of completed builds delivered by Hama Construction.
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
                We combine traditional construction expertise with modern digital tools so you can focus on building, not paperwork.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Secure online reservations and payments",
                  "Verified skilled workers and quality tools",
                  "Real-time project tracking and milestones",
                  "Transparent pricing with no hidden fees",
                  "Dedicated support from inquiry to handover",
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
            <div className="relative">
              <div className="aspect-[4/3] bg-gradient-to-br from-primary-600 to-construction-dark rounded-2xl flex items-center justify-center shadow-2xl">
                <div className="text-center text-white p-8">
                  <Building2 className="w-20 h-20 mx-auto mb-4 opacity-80" />
                  <p className="text-2xl font-bold">Trusted by developers</p>
                  <p className="mt-2 text-primary-200">across residential & commercial projects</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-construction-dark">What Our Clients Say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-accent-400 text-accent-400" />
                  ))}
                </div>
                <p className="text-slate-600 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="font-semibold text-construction-dark">{t.name}</p>
                  <p className="text-sm text-construction-gray">{t.role}</p>
                </div>
              </div>
            ))}
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
            Create an account to browse assets, hire tools & workers, and manage projects today.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors">
              Create Free Account
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
