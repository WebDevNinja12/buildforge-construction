import Link from "next/link";
import {
  Target,
  Eye,
  Heart,
  Award,
  Users,
  Building2,
  ArrowRight,
} from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Excellence",
    description:
      "We deliver quality workmanship and reliable service on every project, big or small.",
  },
  {
    icon: Eye,
    title: "Transparency",
    description:
      "Clear pricing, honest timelines, and open communication from start to finish.",
  },
  {
    icon: Heart,
    title: "Integrity",
    description:
      "We do what we say. Our reputation is built on trust with clients and partners.",
  },
  {
    icon: Award,
    title: "Innovation",
    description:
      "Combining traditional craft with modern technology to build smarter and faster.",
  },
];

const team = [
  {
    name: "David Mensah",
    role: "Founder & CEO",
    bio: "20+ years in construction and real estate development across West Africa.",
  },
  {
    name: "Amina Diallo",
    role: "Head of Operations",
    bio: "Specializes in project delivery, logistics, and workforce management.",
  },
  {
    name: "Robert Chen",
    role: "Technical Director",
    bio: "Leads digital platforms, asset management systems, and quality control.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-construction-dark to-primary-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              About Hama Construction
            </h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed">
              We are a construction and property platform dedicated to making
              asset acquisition, tool rental, labor hiring, and project
              management simple, transparent, and accessible.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-construction-dark">Our Story</h2>
              <div className="mt-6 space-y-4 text-construction-gray leading-relaxed">
                <p>
                  Hama Construction was founded with a simple idea: construction should
                  not be fragmented across phone calls, paper contracts, and
                  scattered suppliers. Clients deserve one place to buy land or
                  properties, reserve assets, hire tools and skilled workers, and
                  track every milestone of their project.
                </p>
                <p>
                  Starting as a small contracting firm, we grew into a full
                  platform serving homeowners, developers, and contractors. Today
                  we combine on-the-ground expertise with a modern digital
                  experience so you can focus on building, not chasing paperwork.
                </p>
                <p>
                  Whether you are purchasing a plot, reserving a completed house,
                  renting excavators, or managing a multi-phase development,
                  Hama Construction is built to support you.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary-600 to-construction-dark rounded-2xl p-10 text-white flex flex-col items-center justify-center min-h-[320px]">
              <Building2 className="w-16 h-16 mb-4 opacity-90" />
              <p className="text-4xl font-bold">15+</p>
              <p className="text-primary-200 mt-1">Years of combined experience</p>
              <p className="mt-6 text-center text-primary-100 max-w-xs">
                Serving residential, commercial and industrial clients with
                reliable delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold text-construction-dark">Our Mission</h3>
              <p className="mt-3 text-construction-gray leading-relaxed">
                To empower individuals and businesses to acquire, build, and
                manage construction projects with clarity, efficiency, and
                confidence — through technology and trusted partnerships.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-accent-600" />
              </div>
              <h3 className="text-xl font-bold text-construction-dark">Our Vision</h3>
              <p className="mt-3 text-construction-gray leading-relaxed">
                To become the leading integrated construction platform in the
                region — where every asset, tool, worker, and project is
                discoverable, bookable, and manageable in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-construction-dark">Our Values</h2>
            <p className="mt-3 text-construction-gray">
              The principles that guide every decision and every project.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <div
                key={v.title}
                className="text-center p-6 rounded-2xl border border-slate-200 hover:border-primary-200 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mx-auto">
                  <v.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="mt-4 font-semibold text-construction-dark">{v.title}</h3>
                <p className="mt-2 text-sm text-construction-gray leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-construction-dark">Leadership Team</h2>
            <p className="mt-3 text-construction-gray">
              Experienced professionals dedicated to your success.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member) => (
              <div
                key={member.name}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full mx-auto flex items-center justify-center">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-construction-dark">{member.name}</h3>
                <p className="text-accent-600 text-sm font-medium">{member.role}</p>
                <p className="mt-3 text-sm text-construction-gray">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-primary-700 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">Want to work with us?</h2>
          <p className="mt-3 text-primary-100">
            Get in touch or explore our services to start your next project.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Contact Us <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 font-semibold px-6 py-3 rounded-xl border border-white/20 transition-colors"
            >
              View Services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
