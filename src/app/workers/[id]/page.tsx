"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Star, HardHat, Loader2, Clock, BadgeCheck,
} from "lucide-react";
import { formatCurrency, WORKER_SPECIALTIES } from "@/lib/utils";

export default function WorkerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/workers/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Worker not found");
        return r.json();
      })
      .then(setWorker)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-red-600">{error || "Not found"}</p>
        <Link href="/services" className="mt-4 inline-block text-primary-600 font-medium">
          ← Back to services
        </Link>
      </div>
    );
  }

  let skills: string[] = [];
  let gallery: string[] = [];
  let pastWork: { title: string; description?: string; imageUrl?: string }[] = [];
  try { skills = JSON.parse(worker.skills || "[]"); } catch {}
  try { gallery = JSON.parse(worker.gallery || "[]"); } catch {}
  try { pastWork = JSON.parse(worker.pastWork || "[]"); } catch {}
  if (worker.image && !gallery.includes(worker.image)) gallery = [worker.image, ...gallery];

  const specialty =
    WORKER_SPECIALTIES.find((s) => s.value === worker.specialty)?.label || worker.specialty;

  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      <div className="bg-gradient-to-br from-construction-dark to-primary-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <button
            type="button"
            onClick={() => router.push("/services")}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> All workers
          </button>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="w-28 h-28 rounded-2xl bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
              {worker.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={worker.image} alt={worker.name} className="w-full h-full object-cover" />
              ) : (
                <HardHat className="w-12 h-12 text-white/70" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{worker.name}</h1>
              <p className="mt-1 text-accent-400 font-medium">{specialty}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                {worker.location && (
                  <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{worker.location}</span>
                )}
                <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" />{worker.experience} years experience</span>
                <span className="inline-flex items-center gap-1"><Star className="w-4 h-4 text-amber-400" />{worker.rating}</span>
                {worker.available ? (
                  <span className="inline-flex items-center gap-1 text-green-400"><BadgeCheck className="w-4 h-4" /> Available</span>
                ) : (
                  <span className="text-amber-300">Currently booked</span>
                )}
              </div>
              <p className="mt-4 text-2xl font-bold text-white">{formatCurrency(worker.dailyRate)}<span className="text-base font-normal text-slate-400"> / day</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl border shadow-sm p-6 sm:p-8 space-y-8">
          {worker.bio && (
            <section>
              <h2 className="font-semibold text-lg text-construction-dark mb-2">About</h2>
              <p className="text-slate-600 whitespace-pre-wrap">{worker.bio}</p>
            </section>
          )}

          {skills.length > 0 && (
            <section>
              <h2 className="font-semibold text-lg text-construction-dark mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span key={s} className="bg-primary-50 text-primary-700 text-sm px-3 py-1 rounded-full">{s}</span>
                ))}
              </div>
            </section>
          )}

          {gallery.length > 0 && (
            <section>
              <h2 className="font-semibold text-lg text-construction-dark mb-3">Photos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {gallery.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="rounded-xl h-36 w-full object-cover border" />
                ))}
              </div>
            </section>
          )}

          {pastWork.length > 0 && (
            <section>
              <h2 className="font-semibold text-lg text-construction-dark mb-3">Past work</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {pastWork.map((p, i) => (
                  <div key={i} className="border rounded-xl p-4">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="rounded-lg h-28 w-full object-cover mb-3" />
                    )}
                    <p className="font-medium">{p.title}</p>
                    {p.description && <p className="text-sm text-slate-500 mt-1">{p.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-semibold text-lg text-construction-dark mb-3">Reviews & comments</h2>
            {(worker.reviews || []).length === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet.</p>
            ) : (
              <ul className="space-y-3">
                {worker.reviews.map((r: any) => (
                  <li key={r.id} className="border rounded-xl p-4">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium">{r.author}</p>
                      <span className="text-xs text-slate-400">{r.source}</span>
                    </div>
                    <p className="text-amber-500 text-sm mt-0.5">{"★".repeat(Math.round(r.rating))}</p>
                    <p className="text-sm text-slate-600 mt-2">{r.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Link
              href="/services"
              className="flex-1 text-center border border-slate-300 font-semibold py-3 rounded-xl hover:bg-slate-50"
            >
              Compare other workers
            </Link>
            <Link
              href={`/services?tab=workers&hire=${worker.id}`}
              className="flex-1 text-center bg-accent-500 hover:bg-accent-600 text-white font-semibold py-3 rounded-xl"
            >
              Reserve this worker
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
