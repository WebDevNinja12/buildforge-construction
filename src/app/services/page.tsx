"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2, MapPin, Wrench, Users, ClipboardList, Hotel,
  Loader2, Star, Eye, Home, Building, Store,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { parseImages, mainImage, PLACEHOLDER_IMAGE } from "@/lib/schedule";
import {
  CLIENT_SERVICE_TABS,
  getCategory,
  type ServiceCategoryId,
} from "@/lib/service-categories";

type Tab = ServiceCategoryId;

interface Asset {
  id: string; title: string; description: string; type: string;
  price: number; location: string; size?: string | null;
  bedrooms?: number | null; bathrooms?: number | null; status: string;
  images?: string; mainImageIndex?: number;
}
interface Tool {
  id: string; name: string; description: string; category: string;
  dailyRate: number; weeklyRate: number; available: number;
  image?: string | null; images?: string | null;
}
interface Worker {
  id: string; name: string; specialty: string; experience: number;
  dailyRate: number; rating: number; bio: string | null;
  image?: string | null; location?: string | null;
}

const TAB_ICONS: Record<string, React.ElementType> = {
  HOUSE: Home, BUILDING: Building2, COMMERCIAL: Store, APARTMENT: Building,
  LAND: MapPin, HOTEL: Hotel, TOOLS: Wrench, WORKERS: Users, OTHER: ClipboardList,
};

const tabs = CLIENT_SERVICE_TABS.map((t) => {
  const cat = getCategory(t.category);
  return {
    id: t.category as Tab,
    label: t.label,
    icon: TAB_ICONS[t.category] || Building2,
    modeLabel: cat?.modeLabel || "",
  };
});

const ASSET_TABS = new Set(["HOUSE", "BUILDING", "COMMERCIAL", "APARTMENT", "LAND", "HOTEL"]);
const SERVICES_BANNER = "/banners/services.jpeg";

function assetCover(a: Asset) {
  const imgs = parseImages(a.images);
  return mainImage(imgs, a.mainImageIndex || 0) || PLACEHOLDER_IMAGE;
}
function toolCover(t: Tool) {
  if (t.image) return t.image;
  return parseImages(t.images)[0] || PLACEHOLDER_IMAGE;
}

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("HOUSE");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [previewTool, setPreviewTool] = useState<Tool | null>(null);
  const [previewWorker, setPreviewWorker] = useState<Worker | null>(null);
  const [toolDates, setToolDates] = useState({ startDate: "", endDate: "", quantity: 1 });
  const [hireExtra, setHireExtra] = useState({ description: "", location: "", startDate: "", endDate: "" });
  const [projectForm, setProjectForm] = useState({
    title: "", description: "", budget: "", location: "", startDate: "", endDate: "",
  });
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const goLogin = useCallback(() => {
    const next = encodeURIComponent("/services" + (typeof window !== "undefined" ? window.location.search : ""));
    window.location.href = `/login?next=${next}`;
  }, []);

  const requireLogin = useCallback(() => {
    if (loggedIn === false) { goLogin(); return false; }
    return true;
  }, [loggedIn, goLogin]);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d?.user))
      .catch(() => setLoggedIn(false));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab") as Tab | null;
      if (tab && tabs.some((t) => t.id === tab)) setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (ASSET_TABS.has(activeTab)) {
          const res = await fetch(`/api/assets?type=${encodeURIComponent(activeTab)}`);
          const data = await res.json();
          if (!cancelled) {
            const list = Array.isArray(data) ? data : [];
            setAssets(list.filter((a: Asset) => String(a.type || "").toUpperCase() === activeTab));
          }
        } else if (activeTab === "TOOLS") {
          const res = await fetch("/api/tools");
          const data = await res.json();
          if (!cancelled) setTools(Array.isArray(data) ? data : []);
        } else if (activeTab === "WORKERS") {
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
    return () => { cancelled = true; };
  }, [activeTab]);

  async function authedPost(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (res.status === 401) { goLogin(); throw new Error("Please sign in to continue"); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function reserveAsset(asset: Asset) {
    if (!requireLogin()) return;
    setActionLoading(asset.id);
    setMessage(null);
    try {
      const data = await authedPost("/api/reservations", { assetId: asset.id, confirmed: true });
      setPreviewAsset(null);
      setMessage({ type: "success", text: data.message || "Reserved. Pay from Dashboard." });
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function reserveTool(tool: Tool) {
    if (!requireLogin()) return;
    if (!toolDates.startDate || !toolDates.endDate) {
      setMessage({ type: "error", text: "Choose start and end dates" });
      return;
    }
    setActionLoading(tool.id);
    setMessage(null);
    try {
      const data = await authedPost("/api/tools", {
        toolId: tool.id,
        startDate: toolDates.startDate,
        endDate: toolDates.endDate,
        quantity: toolDates.quantity || 1,
        confirmed: true,
      });
      setPreviewTool(null);
      setToolDates({ startDate: "", endDate: "", quantity: 1 });
      setMessage({ type: "success", text: data.message || "Tool reserved. Pay from Dashboard." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function reserveWorker(worker: Worker) {
    if (!requireLogin()) return;
    if (!hireExtra.description || !hireExtra.location || !hireExtra.startDate) {
      setMessage({ type: "error", text: "Fill job description, location and start date" });
      return;
    }
    setActionLoading(worker.id);
    setMessage(null);
    try {
      const data = await authedPost("/api/workers", {
        workerId: worker.id,
        serviceType: worker.specialty || "LABOR",
        description: hireExtra.description,
        location: hireExtra.location,
        startDate: hireExtra.startDate,
        endDate: hireExtra.endDate || null,
        estimatedCost: worker.dailyRate,
        confirmed: true,
      });
      setPreviewWorker(null);
      setHireExtra({ description: "", location: "", startDate: "", endDate: "" });
      setMessage({ type: "success", text: data.message || "Worker reserved. Pay from Dashboard." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleProject(e: React.FormEvent) {
    e.preventDefault();
    if (!requireLogin()) return;
    setActionLoading("project");
    try {
      await authedPost("/api/projects", { ...projectForm, budget: Number(projectForm.budget), confirmed: true });
      setMessage({ type: "success", text: "Project created. Manage it from Dashboard." });
      setProjectForm({ title: "", description: "", budget: "", location: "", startDate: "", endDate: "" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  function openPreview(kind: "asset" | "tool" | "worker", item: Asset | Tool | Worker) {
    if (!requireLogin()) return;
    if (kind === "asset") setPreviewAsset(item as Asset);
    if (kind === "tool") {
      setPreviewTool(item as Tool);
      setToolDates({ startDate: "", endDate: "", quantity: 1 });
    }
    if (kind === "worker") {
      const w = item as Worker;
      setPreviewWorker(w);
      setHireExtra({
        description: `Hire ${w.name} (${w.specialty})`,
        location: w.location || "",
        startDate: "",
        endDate: "",
      });
    }
  }

  const activeMeta = tabs.find((t) => t.id === activeTab);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="relative text-white overflow-hidden min-h-[42vh] sm:min-h-[50vh] lg:min-h-[55vh] flex items-center hero-mobile-tight">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${SERVICES_BANNER}')` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-construction-dark/90 via-slate-900/75 to-primary-900/55" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 w-full">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Services</h1>
          <p className="mt-2 text-slate-200 max-w-2xl text-sm sm:text-base">
            Sale, rent and hire categories. Sign in to reserve. Pay from your{" "}
            <Link href="/dashboard" className="underline text-accent-300">Dashboard</Link>.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="tab-scroll sm:flex-wrap sm:overflow-visible">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setActiveTab(tabItem.id)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3.5 min-h-[40px] sm:min-h-[44px] rounded-full sm:rounded-xl text-sm font-medium border whitespace-nowrap ${
                  activeTab === tabItem.id
                    ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                <tabItem.icon className="w-4 h-4 shrink-0" />
                <span className="sm:flex sm:flex-col sm:items-start sm:leading-tight">
                  <span>{tabItem.label}</span>
                  {tabItem.modeLabel ? (
                    <span className={`hidden sm:inline text-[9px] font-medium ${
                      activeTab === tabItem.id ? "text-white/80" : "text-slate-400"
                    }`}>
                      {tabItem.modeLabel}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>

        {activeMeta && (
          <p className="text-sm text-slate-500 mb-4">
            Showing <strong className="text-construction-dark">{activeMeta.label}</strong>
            {activeMeta.modeLabel ? ` · ${activeMeta.modeLabel}` : ""}
          </p>
        )}

        {message && (
          <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {message.text}{" "}
            {message.type === "success" && (
              <Link href="/dashboard" className="font-semibold underline">Dashboard</Link>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
        ) : (
          <>
            {ASSET_TABS.has(activeTab) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {assets.length === 0 ? (
                  <p className="text-slate-500 col-span-full text-center py-12 border border-dashed rounded-2xl bg-white">
                    No {activeMeta?.label?.toLowerCase() || "listings"} available yet.
                  </p>
                ) : assets.map((a) => (
                  <div key={a.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetCover(a)} alt="" className="w-full h-44 object-cover" />
                    <div className="p-4">
                      <p className="text-xs text-primary-600 uppercase font-semibold tracking-wide">
                        {a.type} · {getCategory(a.type)?.modeLabel || ""}
                      </p>
                      <h3 className="font-semibold">{a.title}</h3>
                      {a.location && (
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {a.location}
                        </p>
                      )}
                      <p className="text-sm text-slate-500 line-clamp-2 mt-1">{a.description}</p>
                      <p className="text-accent-600 font-bold mt-2">{formatCurrency(a.price)}</p>
                      <button type="button" onClick={() => openPreview("asset", a)}
                        className="mt-4 w-full bg-primary-600 text-white font-semibold py-2.5 rounded-xl inline-flex items-center justify-center gap-2 min-h-[44px]">
                        <Eye className="w-4 h-4" /> Preview and reserve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "TOOLS" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {tools.length === 0 ? (
                  <p className="text-slate-500 col-span-full text-center py-12 border border-dashed rounded-2xl bg-white">No tools available yet.</p>
                ) : tools.map((tool) => (
                  <div key={tool.id} className="bg-white rounded-2xl border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={toolCover(tool)} alt="" className="w-full h-40 object-cover" />
                    <div className="p-4">
                      <h3 className="font-semibold">{tool.name}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2">{tool.description}</p>
                      <p className="text-sm mt-2">{formatCurrency(tool.dailyRate)}/day · {tool.available} available</p>
                      <button type="button" onClick={() => openPreview("tool", tool)}
                        className="mt-3 w-full bg-primary-600 text-white font-semibold py-2.5 rounded-xl min-h-[44px]">Preview and reserve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "WORKERS" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {workers.length === 0 ? (
                  <p className="text-slate-500 col-span-full text-center py-12 border border-dashed rounded-2xl bg-white">No workers available yet.</p>
                ) : workers.map((w) => (
                  <div key={w.id} className="bg-white rounded-2xl border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.image || PLACEHOLDER_IMAGE} alt="" className="w-full h-40 object-cover" />
                    <div className="p-4">
                      <h3 className="font-semibold">{w.name}</h3>
                      <p className="text-sm text-primary-600">{w.specialty}</p>
                      <p className="text-xs text-slate-500">
                        <Star className="w-3 h-3 inline fill-amber-400 text-amber-400" /> {w.rating} · {formatCurrency(w.dailyRate)}/day
                      </p>
                      <button type="button" onClick={() => openPreview("worker", w)}
                        className="mt-3 w-full bg-primary-600 text-white font-semibold py-2 rounded-xl min-h-[44px]">Preview and reserve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "OTHER" && (
              <form onSubmit={handleProject} className="max-w-xl space-y-4 bg-white border rounded-2xl p-5 sm:p-6">
                <h2 className="text-xl font-bold">Other construction services</h2>
                <p className="text-sm text-slate-500">Submit a project request. You must be signed in.</p>
                <input required placeholder="Title" value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border min-h-[44px]" />
                <textarea required rows={3} placeholder="Description" value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border" />
                <input type="number" placeholder="Budget (₦)" value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border min-h-[44px]" />
                <input placeholder="Location" value={projectForm.location}
                  onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border min-h-[44px]" />
                <button type="submit" disabled={actionLoading === "project"}
                  className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 min-h-[48px]">
                  {actionLoading === "project" ? "Submitting..." : "Submit request"}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-5 space-y-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h3 className="text-lg font-bold">{previewAsset.title}</h3>
            <p className="text-xs text-primary-600 font-semibold uppercase">
              {previewAsset.type} · {getCategory(previewAsset.type)?.modeLabel}
            </p>
            <p className="text-sm text-slate-600">{previewAsset.description}</p>
            <p className="font-bold text-accent-600">{formatCurrency(previewAsset.price)}</p>
            <div className="flex gap-2">
              <button type="button" disabled={!!actionLoading} onClick={() => reserveAsset(previewAsset)}
                className="flex-1 bg-primary-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 min-h-[48px]">
                {actionLoading === previewAsset.id ? "…" : "Confirm reserve"}
              </button>
              <button type="button" onClick={() => setPreviewAsset(null)} className="px-4 border rounded-xl font-semibold min-h-[48px]">Close</button>
            </div>
          </div>
        </div>
      )}

      {previewTool && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h3 className="text-lg font-bold">{previewTool.name}</h3>
            <p className="text-sm text-slate-600">{previewTool.description}</p>
            <p className="text-sm">{formatCurrency(previewTool.dailyRate)}/day · {formatCurrency(previewTool.weeklyRate)}/week</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="border rounded-xl px-3 min-h-[44px] text-sm"
                value={toolDates.startDate} onChange={(e) => setToolDates({ ...toolDates, startDate: e.target.value })} />
              <input type="date" className="border rounded-xl px-3 min-h-[44px] text-sm"
                value={toolDates.endDate} onChange={(e) => setToolDates({ ...toolDates, endDate: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={!!actionLoading} onClick={() => reserveTool(previewTool)}
                className="flex-1 bg-primary-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 min-h-[48px]">
                {actionLoading === previewTool.id ? "…" : "Confirm reserve"}
              </button>
              <button type="button" onClick={() => setPreviewTool(null)} className="px-4 border rounded-xl font-semibold min-h-[48px]">Close</button>
            </div>
          </div>
        </div>
      )}

      {previewWorker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h3 className="text-lg font-bold">{previewWorker.name}</h3>
            <p className="text-sm text-primary-600">{previewWorker.specialty}</p>
            <textarea className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} placeholder="Job description"
              value={hireExtra.description} onChange={(e) => setHireExtra({ ...hireExtra, description: e.target.value })} />
            <input className="w-full border rounded-xl px-3 min-h-[44px] text-sm" placeholder="Location"
              value={hireExtra.location} onChange={(e) => setHireExtra({ ...hireExtra, location: e.target.value })} />
            <input type="date" className="w-full border rounded-xl px-3 min-h-[44px] text-sm"
              value={hireExtra.startDate} onChange={(e) => setHireExtra({ ...hireExtra, startDate: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" disabled={!!actionLoading} onClick={() => reserveWorker(previewWorker)}
                className="flex-1 bg-primary-600 text-white font-semibold py-3 rounded-xl disabled:opacity-50 min-h-[48px]">
                {actionLoading === previewWorker.id ? "…" : "Confirm hire"}
              </button>
              <button type="button" onClick={() => setPreviewWorker(null)} className="px-4 border rounded-xl font-semibold min-h-[48px]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
