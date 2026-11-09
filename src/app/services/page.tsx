"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Wrench,
  Users,
  ClipboardList,
  Hotel,
  Loader2,
  DollarSign,
  Star,
  X,
  Eye,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { parseImages, mainImage, PLACEHOLDER_IMAGE } from "@/lib/schedule";

type Tab = "assets" | "hotels" | "land" | "tools" | "workers" | "projects";

interface Asset {
  id: string;
  title: string;
  description: string;
  type: string;
  price: number;
  location: string;
  size: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  images?: string;
  mainImageIndex?: number;
}
interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  dailyRate: number;
  weeklyRate: number;
  available: number;
  image?: string | null;
  images?: string | null;
}
interface Worker {
  id: string;
  name: string;
  specialty: string;
  experience: number;
  dailyRate: number;
  rating: number;
  bio: string | null;
  image?: string | null;
  location?: string | null;
}

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "assets", label: "Houses & Buildings", icon: Building2 },
  { id: "hotels", label: "Hotels", icon: Hotel },
  { id: "land", label: "Land Payments", icon: MapPin },
  { id: "tools", label: "Tool Hiring", icon: Wrench },
  { id: "workers", label: "Hire Workers", icon: Users },
  { id: "projects", label: "Project Mgmt", icon: ClipboardList },
];

function filterAssetsForTab(list: Asset[], tab: Tab): Asset[] {
  const type = (a: Asset) => String(a.type || "").toUpperCase();
  if (tab === "land") return list.filter((a) => type(a) === "LAND");
  if (tab === "hotels") return list.filter((a) => type(a) === "HOTEL");
  return list.filter((a) => type(a) !== "LAND" && type(a) !== "HOTEL");
}

const SERVICES_BANNER =
  "https://raw.githubusercontent.com/WebDevNinja12/buildforge-construction/main/%F0%9F%9A%80%20Power%20Your%20Business%20with%20the%20Right%20Workforce.jpeg";

function assetCover(a: Asset) {
  const imgs = parseImages(a.images);
  return mainImage(imgs, a.mainImageIndex || 0) || PLACEHOLDER_IMAGE;
}
function toolCover(t: Tool) {
  if (t.image) return t.image;
  return parseImages(t.images)[0] || PLACEHOLDER_IMAGE;
}

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("assets");
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
  const [hireExtra, setHireExtra] = useState({
    description: "",
    location: "",
    startDate: "",
    endDate: "",
  });
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    budget: "",
    location: "",
    startDate: "",
    endDate: "",
  });
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const goLogin = useCallback(() => {
    const next = encodeURIComponent(
      "/services" + (typeof window !== "undefined" ? window.location.search : "")
    );
    window.location.href = `/login?next=${next}`;
  }, []);

  const requireLogin = useCallback(() => {
    if (loggedIn === false) {
      goLogin();
      return false;
    }
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
        if (activeTab === "assets" || activeTab === "hotels" || activeTab === "land") {
          const res = await fetch("/api/assets");
          const data = await res.json();
          if (!cancelled) {
            const list = Array.isArray(data) ? data : [];
            setAssets(filterAssetsForTab(list, activeTab));
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

  async function authedPost(url: string, body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      goLogin();
      throw new Error("Please sign in to continue");
    }
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
      await authedPost("/api/projects", {
        ...projectForm,
        budget: Number(projectForm.budget),
        confirmed: true,
      });
      setMessage({ type: "success", text: "Project created. Manage it from Dashboard." });
      setProjectForm({
        title: "",
        description: "",
        budget: "",
        location: "",
        startDate: "",
        endDate: "",
      });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setActionLoading(null);
    }
  }

  function openPreview(kind: "asset" | "tool" | "worker", item: any) {
    if (!requireLogin()) return;
    if (kind === "asset") setPreviewAsset(item);
    if (kind === "tool") {
      setPreviewTool(item);
      setToolDates({ startDate: "", endDate: "", quantity: 1 });
    }
    if (kind === "worker") {
      setPreviewWorker(item);
      setHireExtra({
        description: `Hire ${item.name} (${item.specialty})`,
        location: item.location || "",
        startDate: "",
        endDate: "",
      });
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="relative text-white overflow-hidden min-h-[220px] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${SERVICES_BANNER}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-construction-dark/90 via-slate-900/75 to-primary-900/55" />
        <div className="relative max-w-7xl mx-auto px-4 py-12 w-full">
          <h1 className="text-3xl sm:text-4xl font-bold">Services</h1>
          <p className="mt-2 text-slate-200 max-w-2xl">
            Houses, hotels, land, tools, and workers. Sign in to preview and reserve. Pay from your{" "}
            <Link href="/dashboard" className="underline text-accent-300">
              Dashboard
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
                activeTab === t.id ? "bg-primary-600 text-white" : "bg-white text-slate-600 border"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div
            className={`mb-6 rounded-xl px-4 py-3 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}{" "}
            {message.type === "success" && (
              <Link href="/dashboard" className="font-semibold underline">
                Dashboard →
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
            {(activeTab === "assets" || activeTab === "hotels" || activeTab === "land") && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {assets.length === 0 ? (
                  <p className="text-slate-500 col-span-full">
                    {activeTab === "hotels"
                      ? "No hotel listings yet. Check back soon."
                      : activeTab === "land"
                        ? "No land listings available."
                        : "No house or building listings available."}
                  </p>
                ) : (
                  assets.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white rounded-2xl border overflow-hidden shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={assetCover(a)} alt="" className="w-full h-44 object-cover" />
                      <div className="p-4">
                        <p className="text-xs text-primary-600 uppercase font-semibold tracking-wide">
                          {a.type}
                        </p>
                        <h3 className="font-semibold">{a.title}</h3>
                        {a.location && (
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {a.location}
                          </p>
                        )}
                        <p className="text-sm text-slate-500 line-clamp-2 mt-1">{a.description}</p>
                        <p className="text-accent-600 font-bold mt-2">{formatCurrency(a.price)}</p>
                        <button
                          type="button"
                          onClick={() => openPreview("asset", a)}
                          className="mt-4 w-full bg-primary-600 text-white font-semibold py-2.5 rounded-xl inline-flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />{" "}
                          {activeTab === "hotels"
                            ? "Preview & reserve hotel"
                            : activeTab === "land"
                              ? "Preview & reserve land"
                              : "Preview & reserve"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "tools" && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                  <div key={tool.id} className="bg-white rounded-2xl border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={toolCover(tool)} alt="" className="w-full h-40 object-cover" />
                    <div className="p-4">
                      <h3 className="font-semibold">{tool.name}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2">{tool.description}</p>
                      <p className="text-sm mt-2">
                        <DollarSign className="w-3.5 h-3.5 inline" />
                        {formatCurrency(tool.dailyRate)}/day
                      </p>
                      <button
                        type="button"
                        onClick={() => openPreview("tool", tool)}
                        className="mt-3 w-full bg-primary-600 text-white font-semibold py-2.5 rounded-xl"
                      >
                        Preview & reserve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "workers" && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {workers.map((w) => (
                  <div key={w.id} className="bg-white rounded-2xl border overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={w.image || PLACEHOLDER_IMAGE}
                      alt=""
                      className="w-full h-40 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-semibold">{w.name}</h3>
                      <p className="text-sm text-primary-600">{w.specialty}</p>
                      <p className="text-xs text-slate-500">
                        <Star className="w-3 h-3 inline fill-amber-400 text-amber-400" /> {w.rating} ·{" "}
                        {formatCurrency(w.dailyRate)}/day
                      </p>
                      <button
                        type="button"
                        onClick={() => openPreview("worker", w)}
                        className="mt-3 w-full bg-primary-600 text-white font-semibold py-2 rounded-xl"
                      >
                        Preview & reserve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "projects" && (
              <form
                onSubmit={handleProject}
                className="max-w-xl space-y-4 bg-white border rounded-2xl p-6"
              >
                <h2 className="text-xl font-bold">Start a project</h2>
                <p className="text-sm text-slate-500">You must be signed in to submit.</p>
                <input
                  required
                  placeholder="Title"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Description"
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                />
                <input
                  type="number"
                  placeholder="Budget"
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                />
                <input
                  placeholder="Location"
                  value={projectForm.location}
                  onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border"
                />
                <button
                  type="submit"
                  disabled={!!actionLoading}
                  className="w-full bg-accent-500 text-white font-semibold py-3 rounded-xl"
                >
                  {actionLoading === "project" ? "Submitting…" : "Submit project"}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              type="button"
              onClick={() => setPreviewAsset(null)}
              className="absolute right-4 top-4"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetCover(previewAsset)}
              alt=""
              className="w-full h-48 object-cover rounded-xl"
            />
            <p className="text-xs text-primary-600 uppercase font-semibold mt-4">{previewAsset.type}</p>
            <h2 className="text-xl font-bold mt-1">{previewAsset.title}</h2>
            <p className="text-sm text-slate-600 mt-2">{previewAsset.description}</p>
            <p className="font-bold text-accent-600 mt-2">{formatCurrency(previewAsset.price)}</p>
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => reserveAsset(previewAsset)}
              className="mt-4 w-full bg-accent-500 text-white font-semibold py-3 rounded-xl"
            >
              {actionLoading === previewAsset.id ? "Reserving…" : "Confirm reservation"}
            </button>
          </div>
        </div>
      )}

      {previewTool && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative">
            <button
              type="button"
              onClick={() => setPreviewTool(null)}
              className="absolute right-4 top-4"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">{previewTool.name}</h2>
            <p className="text-sm text-slate-600 mt-2">{previewTool.description}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <input
                type="date"
                value={toolDates.startDate}
                onChange={(e) => setToolDates({ ...toolDates, startDate: e.target.value })}
                className="border rounded-lg px-3 py-2"
              />
              <input
                type="date"
                value={toolDates.endDate}
                onChange={(e) => setToolDates({ ...toolDates, endDate: e.target.value })}
                className="border rounded-lg px-3 py-2"
              />
            </div>
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => reserveTool(previewTool)}
              className="mt-4 w-full bg-accent-500 text-white font-semibold py-3 rounded-xl"
            >
              {actionLoading === previewTool.id ? "Reserving…" : "Confirm tool rental"}
            </button>
          </div>
        </div>
      )}

      {previewWorker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative space-y-3">
            <button
              type="button"
              onClick={() => setPreviewWorker(null)}
              className="absolute right-4 top-4"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">{previewWorker.name}</h2>
            <p className="text-sm text-primary-600">{previewWorker.specialty}</p>
            <textarea
              rows={2}
              placeholder="Job description"
              value={hireExtra.description}
              onChange={(e) => setHireExtra({ ...hireExtra, description: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Location"
              value={hireExtra.location}
              onChange={(e) => setHireExtra({ ...hireExtra, location: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={hireExtra.startDate}
              onChange={(e) => setHireExtra({ ...hireExtra, startDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!!actionLoading}
              onClick={() => reserveWorker(previewWorker)}
              className="w-full bg-accent-500 text-white font-semibold py-3 rounded-xl"
            >
              {actionLoading === previewWorker.id ? "Reserving…" : "Confirm hire"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
