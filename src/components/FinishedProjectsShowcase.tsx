"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, MapPin, ArrowRight, Loader2 } from "lucide-react";

interface FinishedProject {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  completedAt: string;
}

export default function FinishedProjectsShowcase() {
  const [projects, setProjects] = useState<FinishedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finished-projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data.slice(0, 6));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (projects.length === 0) return null;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((p) => (
        <div
          key={p.id}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="h-36 bg-gradient-to-br from-primary-600 to-construction-dark flex items-center justify-center">
            <Building2 className="w-12 h-12 text-white/70" />
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-construction-dark">{p.title}</h3>
              <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{p.category}</span>
            </div>
            <p className="mt-2 text-sm text-construction-gray line-clamp-2">{p.description}</p>
            <p className="mt-3 text-xs text-slate-500 inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />{p.location}
            </p>
          </div>
        </div>
      ))}
      <div className="md:col-span-2 lg:col-span-3 text-center pt-2">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700"
        >
          View all finished projects <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
