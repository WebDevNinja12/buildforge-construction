"use client";

import { useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";

type T = {
  id: string;
  clientName: string;
  role?: string | null;
  project?: string | null;
  quote: string;
  rating: number;
};

const FALLBACK: T[] = [
  {
    id: "1",
    clientName: "Adebayo O.",
    role: "Homeowner",
    project: "Residential build",
    quote:
      "Hama handled our house reservation and payments clearly. The team was professional from start to finish.",
    rating: 5,
  },
  {
    id: "2",
    clientName: "Chioma N.",
    role: "Developer",
    project: "Land & tools",
    quote:
      "Reserving land and hiring equipment on one platform saved us weeks of chasing vendors.",
    rating: 5,
  },
  {
    id: "3",
    clientName: "Ibrahim K.",
    role: "Project owner",
    project: "Worker hire",
    quote:
      "Worker profiles with real rates made hiring straightforward. Admin support was responsive.",
    rating: 5,
  },
];

export function Testimonials() {
  const [items, setItems] = useState<T[]>(FALLBACK);

  useEffect(() => {
    fetch("/api/testimonials")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length) setItems(d);
      })
      .catch(() => null);
  }, []);

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-construction-dark">What clients say</h2>
          <p className="mt-3 text-construction-gray">
            Real feedback from people who built, reserved, and hired with Hama Construction.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {items.slice(0, 6).map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border p-6 shadow-sm relative">
              <Quote className="w-8 h-8 text-accent-500/30 absolute top-4 right-4" />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: Math.min(5, t.rating || 5) }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-slate-700 leading-relaxed text-sm">“{t.quote}”</p>
              <div className="mt-4 pt-4 border-t">
                <p className="font-semibold text-construction-dark">{t.clientName}</p>
                <p className="text-xs text-slate-500">
                  {[t.role, t.project].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
