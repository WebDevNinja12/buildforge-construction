"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2, MapPin, Wrench, Users, ClipboardList,
  CheckCircle2, Loader2, DollarSign, Star, X, Eye, Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { parseImages, mainImage, PLACEHOLDER_IMAGE } from "@/lib/schedule";

type Tab = "assets" | "land" | "tools" | "workers" | "projects";

interface Asset {
  id: string; title: string; description: string; type: string;
  price: number; location: string; size: string | null;
  bedrooms: number | null; bathrooms: number | null; status: string;
  images?: string; mainImageIndex?: number; features?: string | null;
}
interface Tool {
  id: string; name: string; description: string; category: string;
  dailyRate: number; weeklyRate: number; available: number;
  image?: string | null; images?: string | null;
}
interface Worker {
  id: string; name: string; specialty: string; experience: number;
  dailyRate: number; rating: number; bio: string | null;
  image?: string | null; location?: string | null; skills?: string | null;
}

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "assets", label: "Buy & Reserve", icon: Building2 },
  { id: "land", label: "Land Payments", icon: MapPin },
  { id: "tools", label: "Tool Hiring", icon: Wrench },
  { id: "workers", label: "Hire Workers", icon: Users },
  { id: "projects", label: "Project Mgmt", icon: ClipboardList },
];

function assetCover(a: Asset) {
  const imgs = parseImages(a.images);
  return mainImage(imgs, a.mainImageIndex || 0) || PLACEHOLDER_IMAGE;
}

function toolCover(t: Tool) {
  if (t.image) return t.image;
  const imgs = parseImages(t.images);
  return imgs[0] || PLACEHOLDER_IMAGE;
}

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("assets");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Preview panels
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [previewTool, setPreviewTool] = useState<Tool | null>(null);
  const [previewWorker, setPreviewWorker] = useState<Worker | null>(null);

  // Tool rental after preview
  const [toolDates, setToolDates] = useState({ startDate: "", endDate: "", quantity: 1 });
  // Worker hire after preview
  const [hireExtra, setHireExtra] = useState({
    description: "", location: "", startDate: "", endDate: "",
  });

  const [projectForm, setProjectForm] = useState({
    title: "", description: "", budget: "", location: "", startDate: "", endDate: "",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as Tab | null;
      if (tab && tabs.some((t) => t.id === tab)) setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMessage(null);
      try {
        if (activeTab === "assets" || activeTab === "land") {
          const res = await fetch("/api/assets");
          const data = await res.json();
          if (!cancelled) {
            const list = Array.isArray(data) ? data : [];
            setAssets(
              activeTab === "land"
                ? list.filter((a: Asset) => a.type === "LAND")
                : list.filter((a: Asset) => a.type !== "LAND")
            );
          }
        } else if (activeTab === "tools") {
          const res = await fetch("/api/tools");
          const data = await res.json();
          if (!cancelled) setTools(Array.isArray(data) ? data : []);
        } else if (activeTab === "workers") {
          const res = await fetch("/api/workers");
          const data = await res.json();
          if (!cancelled) setWorkers(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setMessage({ type: "error", text: "Failed to load listings" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  async function reserveAsset(asset: Asset) {
    setActionLoading(asset.id);
    setMessage(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reserve failed");
      setPreviewAsset(null);
      setMessage({
        type: "success",
        text: data.message || "Reserved. Open Dashboard to choose payment and pay.",
      });
      // refresh list
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function reserveTool(tool: Tool) {
    if (!toolDates.startDate || !toolDates.endDate) {
      setMessage({ type: "error", text: "Choose start and end dates" });
      return;
    }
    setActionLoading(tool.id);
    setMessage(null);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: tool.id,
          startDate: toolDates.startDate,
          endDate: toolDates.endDate,
          quantity: toolDates.quantity || 1,
          confirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reserve failed");
      setPreviewTool(null);
      setToolDates({ startDate: "", endDate: "", quantity: 1 });
      setMessage({
        type: "success",
        text: data.message || "Tool reserved. Pay from Dashboard.",
      });
      setTools((prev) =>
        prev
          .map((t) =>
            t.id === tool.id ? { ...t, available: Math.max(0, t.available - (toolDates.quantity || 1)) } : t
          )
          .filter((t) => t.available > 0)
      );
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function reserveWorker(worker: Worker) {
    if (!hireExtra.description || !hireExtra.location || !hireExtra.startDate) {
      setMessage({ type: "error", text: "Fill job description, location and start date" });
      return;
    }
    setActionLoading(worker.id);
    setMessage(null);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: worker.id,
          serviceType: worker.specialty || "LABOR",
          description: hireExtra.description,
          location: hireExtra.location,
          startDate: hireExtra.startDate,
          endDate: hireExtra.endDate || null,
          estimatedCost: worker.dailyRate,
          confirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reserve failed");
      setPreviewWorker(null);
      setHireExtra({ description: "", location: "", startDate: "", endDate: "" });
      setMessage({
        type: "success",
        text: data.message || "Worker reserved. Pay from Dashboard.",
      });
      setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleProject(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading("project");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...projectForm,
          budget: Number(projectForm.budget),
          confirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessage({ type: "success", text: "Project created. Manage it from Dashboard." });
      setProjectForm({ title: "", description: "", budget: "", location: "", startDate: "", endDate: "" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-construction-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl font-bold">Services</h1>
          <p className="mt-2 text-slate-300 max-w-2xl">
            Preview full details, then <strong className="text-accent-400">reserve</strong>.
            Choose payment and pay later from your <Link href="/dashboard" className="underline text-accent-300">Dashboard</Link>.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-primary-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-primary-300"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div
            className={`mb-6 rounded-xl px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2 ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <span className="flex-1">{message.text}</span>
            {message.type === "success" && (
              <Link href="/dashboard" className="font-semibold underline shrink-0">
                Go to Dashboard →
              </Link>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            {(activeTab === "assets" || activeTab === "land") && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {assets.length === 0 ? (
                  <p className="text-slate-500 col-span-full">No listings available right now.</p>
                ) : (
                  assets.map((a) => (
                    <div key={a.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={assetCover(a)} alt={a.title} className="w-full h-44 object-cover" />
                      <div className="p-4">
                        <p className="text-xs font-medium text-primary-600 uppercase">{a.type}</p>
                        <h3 className="font-semibold text-construction-dark mt-1">{a.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mt-1">{a.description}</p>
                        <p className="text-accent-600 font-bold mt-2">{formatCurrency(a.price)}</p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {a.location}
                        </p>
                        <button
                          type="button"
                          onClick={() => setPreviewAsset(a)}
                          className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl"
                        >
                          <Eye className="w-4 h-4" /> Preview & reserve
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "tools" && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.length === 0 ? (
                  <p className="text-slate-500 col-span-full">No tools available.</p>
                ) : (
                  tools.map((tool) => (
                    <div
                      key={tool.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-primary-300 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={toolCover(tool)} alt={tool.name} className="w-full h-40 object-cover bg-slate-100" />
                      <div className="p-4">
                        <p className="text-xs text-slate-500">{tool.category}</p>
                        <h3 className="font-semibold">{tool.name}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mt-1">{tool.description}</p>
                        <p className="text-sm mt-2 font-medium">
                          <DollarSign className="w-3.5 h-3.5 inline" />
                          {formatCurrency(tool.dailyRate)}/day · {formatCurrency(tool.weeklyRate)}/week
                        </p>
                        <p className="text-xs text-slate-400">{tool.available} available</p>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewTool(tool);
                            setToolDates({ startDate: "", endDate: "", quantity: 1 });
                          }}
                          className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-primary-600 text-white font-semibold py-2.5 rounded-xl"
                        >
                          <Eye className="w-4 h-4" /> Preview & reserve
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "workers" && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {workers.length === 0 ? (
                  <p className="text-slate-500 col-span-full">No workers available.</p>
                ) : (
                  workers.map((w) => (
                    <div key={w.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={w.image || PLACEHOLDER_IMAGE}
                        alt={w.name}
                        className="w-full h-40 object-cover bg-slate-100"
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{w.name}</h3>
                          <span className="text-xs flex items-center gap-0.5 text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-amber-500" /> {w.rating}
                          </span>
                        </div>
                        <p className="text-sm text-primary-600">{w.specialty}</p>
                        <p className="text-xs text-slate-500 mt-1">{w.experience} yrs · {formatCurrency(w.dailyRate)}/day</p>
                        <p className="text-sm text-slate-500 line-clamp-2 mt-2">{w.bio || "Professional crew member."}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewWorker(w);
                              setHireExtra({
                                description: `Hire ${w.name} (${w.specialty})`,
                                location: w.location || "",
                                startDate: "",
                                endDate: "",
                              });
                            }}
                            className="flex-1 bg-primary-600 text-white text-sm font-semibold py-2 rounded-xl"
                          >
                            Preview & reserve
                          </button>
                          <Link
                            href={`/workers/${w.id}`}
                            className="px-3 py-2 border rounded-xl text-sm text-primary-700"
                          >
                            Profile
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "projects" && (
              <form onSubmit={handleProject} className="max-w-xl space-y-4 bg-white border rounded-2xl p-6">
                <h2 className="text-xl font-bold">Start a project</h2>
                <input required placeholder="Title" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                <textarea required rows={3} placeholder="Description" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                <input required placeholder="Location" value={projectForm.location} onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                <input required type="number" placeholder="Budget" value={projectForm.budget} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                <button type="submit" disabled={actionLoading === "project"} className="bg-accent-500 text-white font-semibold px-5 py-2.5 rounded-xl">
                  Create project
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Asset preview */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetCover(previewAsset)} alt="" className="w-full h-52 object-cover" />
            <div className="p-5 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-xs text-primary-600 font-medium">{previewAsset.type}</p>
                  <h2 className="text-xl font-bold">{previewAsset.title}</h2>
                </div>
                <button type="button" onClick={() => setPreviewAsset(null)} className="p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-accent-600 font-bold text-lg">{formatCurrency(previewAsset.price)}</p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{previewAsset.description}</p>
              <ul className="text-sm text-slate-500 space-y-1">
                <li className="flex gap-2"><MapPin className="w-4 h-4" /> {previewAsset.location}</li>
                {previewAsset.size && <li>Size: {previewAsset.size}</li>}
                {previewAsset.bedrooms != null && <li>Bedrooms: {previewAsset.bedrooms}</li>}
                {previewAsset.bathrooms != null && <li>Bathrooms: {previewAsset.bathrooms}</li>}
              </ul>
              <p className="text-xs bg-amber-50 border border-amber-100 text-amber-900 rounded-lg px-3 py-2">
                Reserving holds this listing. You will choose full or installment payment and pay from your Dashboard.
              </p>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => reserveAsset(previewAsset)}
                className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                {actionLoading === previewAsset.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm reservation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool preview */}
      {previewTool && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={toolCover(previewTool)} alt="" className="w-full h-52 object-cover" />
            <div className="p-5 space-y-3">
              <div className="flex justify-between">
                <h2 className="text-xl font-bold">{previewTool.name}</h2>
                <button type="button" onClick={() => setPreviewTool(null)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <p className="text-sm text-slate-500">{previewTool.category}</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{previewTool.description}</p>
              <p className="font-semibold">
                {formatCurrency(previewTool.dailyRate)}/day · {formatCurrency(previewTool.weeklyRate)}/week
              </p>
              <p className="text-xs text-slate-500">{previewTool.available} units available</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  <span className="text-slate-500 flex items-center gap-1 mb-1"><Calendar className="w-3.5 h-3.5" /> Start</span>
                  <input type="date" required value={toolDates.startDate} onChange={(e) => setToolDates({ ...toolDates, startDate: e.target.value })} className="w-full border rounded-lg px-2 py-2" />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500 mb-1 block">End</span>
                  <input type="date" required value={toolDates.endDate} onChange={(e) => setToolDates({ ...toolDates, endDate: e.target.value })} className="w-full border rounded-lg px-2 py-2" />
                </label>
              </div>
              <label className="text-sm block">
                Quantity
                <input type="number" min={1} max={previewTool.available} value={toolDates.quantity} onChange={(e) => setToolDates({ ...toolDates, quantity: Number(e.target.value) || 1 })} className="w-full border rounded-lg px-2 py-2 mt-1" />
              </label>
              <p className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Reserve first. Complete payment from your Dashboard before the hold expires.
              </p>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => reserveTool(previewTool)}
                className="w-full bg-accent-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                {actionLoading === previewTool.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm tool reservation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Worker preview */}
      {previewWorker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewWorker.image || PLACEHOLDER_IMAGE} alt="" className="w-full h-52 object-cover" />
            <div className="p-5 space-y-3">
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-bold">{previewWorker.name}</h2>
                  <p className="text-primary-600 text-sm">{previewWorker.specialty}</p>
                </div>
                <button type="button" onClick={() => setPreviewWorker(null)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <p className="text-sm text-slate-600">{previewWorker.bio || "Experienced construction professional."}</p>
              <p className="text-sm">{previewWorker.experience} years experience · {formatCurrency(previewWorker.dailyRate)}/day · ★ {previewWorker.rating}</p>
              {previewWorker.location && <p className="text-xs text-slate-500">Based in {previewWorker.location}</p>}
              <textarea
                rows={2}
                placeholder="Job description"
                value={hireExtra.description}
                onChange={(e) => setHireExtra({ ...hireExtra, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Work location"
                value={hireExtra.location}
                onChange={(e) => setHireExtra({ ...hireExtra, location: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={hireExtra.startDate} onChange={(e) => setHireExtra({ ...hireExtra, startDate: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" />
                <input type="date" value={hireExtra.endDate} onChange={(e) => setHireExtra({ ...hireExtra, endDate: e.target.value })} className="border rounded-lg px-2 py-2 text-sm" placeholder="End (optional)" />
              </div>
              <p className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                This holds the worker. Pay from Dashboard after reserving.
              </p>
              <button
                type="button"
                disabled={!!actionLoading}
                onClick={() => reserveWorker(previewWorker)}
                className="w-full bg-accent-500 text-white font-semibold py-3 rounded-xl"
              >
                {actionLoading === previewWorker.id ? "Reserving…" : "Confirm hire reservation"}
              </button>
              <Link href={`/workers/${previewWorker.id}`} className="block text-center text-sm text-primary-600">
                View full profile
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
