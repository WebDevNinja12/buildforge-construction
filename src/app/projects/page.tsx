"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, MapPin, Calendar, Loader2, ArrowRight } from "lucide-react";

interface FinishedProject {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  completedAt: string;
  imageUrl: string | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<FinishedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finished-projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white min-h-screen">
      <section className="bg-gradient-to-br from-construction-dark to-primary-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Finished Projects</h1>
          <p className="mt-4 text-lg text-slate-300 max-w-2xl">
            Recent completed work by Hama Construction — residential, commercial, and infrastructure.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
              <Building2 className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="mt-4 text-construction-gray">No finished projects published yet.</p>
              <p className="text-sm text-slate-500 mt-1">Admins can add them from the dashboard.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((p) => (
                <article
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="h-44 bg-gradient-to-br from-primary-600 to-construction-dark flex items-center justify-center">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-14 h-14 text-white/70" />
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-lg text-construction-dark">{p.title}</h2>
                      <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded shrink-0">
                        {p.category}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-construction-gray line-clamp-3">{p.description}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{p.location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(p.completedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Start your project <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
