"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2, MapPin, Wrench, Users, ClipboardList, ArrowRight,
  CheckCircle2, Loader2, DollarSign,
} from "lucide-react";
import { formatCurrency, WORKER_SPECIALTIES } from "@/lib/utils";

type Tab = "assets" | "land" | "tools" | "workers" | "projects";

interface Asset {
  id: string; title: string; description: string; type: string;
  price: number; location: string; size: string | null;
  bedrooms: number | null; bathrooms: number | null; status: string;
}
interface Tool {
  id: string; name: string; description: string; category: string;
  dailyRate: number; weeklyRate: number; available: number;
}
interface Worker {
  id: string; name: string; specialty: string; experience: number;
  dailyRate: number; rating: number; bio: string | null;
}

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "assets", label: "Buy & Reserve", icon: Building2 },
  { id: "land", label: "Land Payments", icon: MapPin },
  { id: "tools", label: "Tool Hiring", icon: Wrench },
  { id: "workers", label: "Hire Workers", icon: Users },
  { id: "projects", label: "Project Mgmt", icon: ClipboardList },
];

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("assets");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rentalForm, setRentalForm] = useState({ toolId: "", startDate: "", endDate: "", quantity: 1 });
  const [hireForm, setHireForm] = useState({
    workerId: "", serviceType: "LABOR", description: "", location: "", startDate: "", endDate: "",
  });
  const [projectForm, setProjectForm] = useState({
    title: "", description: "", budget: "", location: "", startDate: "", endDate: "",
  });

  useEffect(() => { loadData(); }, [activeTab]);

  async function loadData() {
    setLoading(true);
    setMessage(null);
    try {
      if (activeTab === "assets" || activeTab === "land") {
        const res = await fetch("/api/assets");
        if (res.ok) setAssets(await res.json());
      } else if (activeTab === "tools") {
        const res = await fetch("/api/tools");
        if (res.ok) setTools(await res.json());
      } else if (activeTab === "workers") {
        const res = await fetch("/api/workers");
        if (res.ok) setWorkers(await res.json());
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  }

  async function handleReserve(assetId: string) {
    setActionLoading(assetId);
    setMessage(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reservation failed");
      setMessage({ type: "success", text: "Reservation submitted! Check your dashboard." });
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Reservation failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRent(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading("rent");
    setMessage(null);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rentalForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rental failed");
      setMessage({ type: "success", text: `Rental booked. Total: ${formatCurrency(data.totalCost)}` });
      setRentalForm({ toolId: "", startDate: "", endDate: "", quantity: 1 });
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Rental failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleHire(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading("hire");
    setMessage(null);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hireForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hire request failed");
      setMessage({ type: "success", text: "Hire request submitted!" });
      setHireForm({ workerId: "", serviceType: "LABOR", description: "", location: "", startDate: "", endDate: "" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Hire request failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleProject(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading("project");
    setMessage(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");
      setMessage({ type: "success", text: "Project created! View it in your dashboard." });
      setProjectForm({ title: "", description: "", budget: "", location: "", startDate: "", endDate: "" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to create project" });
    } finally {
      setActionLoading(null);
    }
  }

  const filteredAssets =
    activeTab === "land"
      ? assets.filter((a) => a.type === "LAND")
      : assets.filter((a) => a.type !== "LAND");

  return (
    <div className="bg-white min-h-screen">
      <section className="bg-gradient-to-br from-construction-dark to-primary-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Our Services</h1>
          <p className="mt-4 text-lg text-slate-300 max-w-2xl">
            Buy or reserve properties, pay for land, hire tools and skilled workers, and manage projects.
          </p>
        </div>
      </section>

      <div className="sticky top-16 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto gap-1 py-2">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id ? "bg-primary-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg flex items-center gap-2 ${
            message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {message.type === "success" && <CheckCircle2 className="w-5 h-5" />}
            {message.text}
            {message.type === "success" && (
              <Link href="/dashboard" className="ml-auto text-sm font-medium underline">Go to Dashboard</Link>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            {(activeTab === "assets" || activeTab === "land") && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-construction-dark">
                    {activeTab === "land" ? "Land for Sale & Payment Plans" : "Properties for Sale & Reservation"}
                  </h2>
                  <p className="mt-2 text-construction-gray">
                    {activeTab === "land" ? "Browse available plots and arrange flexible payment plans." : "Browse houses, hotels, apartments and commercial properties. Reserve with a deposit."}
                  </p>
                </div>
                {filteredAssets.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
                    <Building2 className="w-12 h-12 text-slate-400 mx-auto" />
                    <p className="mt-4 text-construction-gray">No {activeTab === "land" ? "land" : "properties"} available. Seed the database or check back later.</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAssets.map((asset) => (
                      <div key={asset.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="h-40 bg-gradient-to-br from-primary-600 to-construction-dark flex items-center justify-center">
                          <Building2 className="w-12 h-12 text-white/70" />
                        </div>
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-construction-dark">{asset.title}</h3>
                            <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{asset.type}</span>
                          </div>
                          <p className="mt-1 text-sm text-construction-gray line-clamp-2">{asset.description}</p>
                          <div className="mt-3 flex items-center gap-1 text-sm text-slate-500"><MapPin className="w-3.5 h-3.5" />{asset.location}</div>
                          {asset.size && <p className="text-sm text-slate-500 mt-1">Size: {asset.size}</p>}
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-lg font-bold text-accent-600">{formatCurrency(asset.price)}</span>
                            <button onClick={() => handleReserve(asset.id)} disabled={!!actionLoading}
                              className="text-sm font-medium bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
                              {actionLoading === asset.id ? "..." : "Reserve"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "land" && (
                  <div className="mt-10 bg-primary-50 rounded-2xl p-6 border border-primary-100">
                    <h3 className="font-semibold text-primary-900">Land Payment Plans</h3>
                    <p className="mt-2 text-sm text-primary-800">Flexible installment options available. Typical plans: 20–40% down, balance over 6–24 months.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "tools" && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-construction-dark">Tool & Equipment Hiring</h2>
                  <p className="mt-2 text-construction-gray">Rent professional tools and heavy equipment by the day or week.</p>
                </div>
                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    {tools.length === 0 ? (
                      <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
                        <Wrench className="w-12 h-12 text-slate-400 mx-auto" />
                        <p className="mt-4 text-construction-gray">No tools listed yet.</p>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {tools.map((tool) => (
                          <div key={tool.id}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                              rentalForm.toolId === tool.id ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200" : "border-slate-200 hover:border-primary-300"
                            }`}
                            onClick={() => setRentalForm({ ...rentalForm, toolId: tool.id })}>
                            <div className="flex justify-between items-start">
                              <h3 className="font-semibold text-construction-dark">{tool.name}</h3>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{tool.category}</span>
                            </div>
                            <p className="text-sm text-construction-gray mt-1 line-clamp-2">{tool.description}</p>
                            <div className="mt-3 flex gap-4 text-sm">
                              <span><DollarSign className="w-3.5 h-3.5 inline" />{formatCurrency(tool.dailyRate)}/day</span>
                              <span className="text-slate-500">{formatCurrency(tool.weeklyRate)}/week</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{tool.available} available</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 h-fit sticky top-28">
                    <h3 className="font-semibold text-construction-dark mb-4">Book a Rental</h3>
                    <form onSubmit={handleRent} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Selected Tool</label>
                        <p className="text-sm text-construction-gray">{rentalForm.toolId ? tools.find((t) => t.id === rentalForm.toolId)?.name || "Selected" : "Click a tool on the left"}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input type="number" min={1} value={rentalForm.quantity} onChange={(e) => setRentalForm({ ...rentalForm, quantity: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                        <input type="date" required value={rentalForm.startDate} onChange={(e) => setRentalForm({ ...rentalForm, startDate: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                        <input type="date" required value={rentalForm.endDate} onChange={(e) => setRentalForm({ ...rentalForm, endDate: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <button type="submit" disabled={!rentalForm.toolId || actionLoading === "rent"}
                        className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors">
                        {actionLoading === "rent" ? "Booking..." : "Confirm Rental"}
                      </button>
                      <p className="text-xs text-slate-500">You must be logged in.</p>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "workers" && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-construction-dark">Hire Construction Workers</h2>
                  <p className="mt-2 text-construction-gray">Hire specialists or request a full crew.</p>
                </div>
                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    {workers.length === 0 ? (
                      <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
                        <Users className="w-12 h-12 text-slate-400 mx-auto" />
                        <p className="mt-4 text-construction-gray">No workers listed yet.</p>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {workers.map((w) => (
                          <div key={w.id}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                              hireForm.workerId === w.id ? "border-primary-500 bg-primary-50 ring-2 ring-primary-200" : "border-slate-200 hover:border-primary-300"
                            }`}
                            onClick={() => setHireForm({ ...hireForm, workerId: w.id })}>
                            <div className="flex justify-between">
                              <h3 className="font-semibold text-construction-dark">{w.name}</h3>
                              <span className="text-xs bg-accent-100 text-accent-700 px-2 py-0.5 rounded">★ {w.rating}</span>
                            </div>
                            <p className="text-sm text-primary-600 font-medium mt-0.5">{WORKER_SPECIALTIES.find((s) => s.value === w.specialty)?.label || w.specialty}</p>
                            <p className="text-sm text-construction-gray mt-1">{w.experience} years · {formatCurrency(w.dailyRate)}/day</p>
                            {w.bio && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{w.bio}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 h-fit sticky top-28">
                    <h3 className="font-semibold text-construction-dark mb-4">Request Hire</h3>
                    <form onSubmit={handleHire} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Worker (optional)</label>
                        <p className="text-sm text-construction-gray">{hireForm.workerId ? workers.find((w) => w.id === hireForm.workerId)?.name : "Any / select from list"}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Service Type</label>
                        <select value={hireForm.serviceType} onChange={(e) => setHireForm({ ...hireForm, serviceType: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500">
                          <option value="LABOR">General Labor</option>
                          <option value="SPECIALIST">Specialist</option>
                          <option value="FULL_CREW">Full Crew</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                        <textarea required rows={3} value={hireForm.description} onChange={(e) => setHireForm({ ...hireForm, description: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500 resize-none" placeholder="Describe the work needed..." />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
                        <input type="text" required value={hireForm.location} onChange={(e) => setHireForm({ ...hireForm, location: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" placeholder="Site address" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                        <input type="date" required value={hireForm.startDate} onChange={(e) => setHireForm({ ...hireForm, startDate: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <button type="submit" disabled={actionLoading === "hire"}
                        className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors">
                        {actionLoading === "hire" ? "Submitting..." : "Submit Request"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "projects" && (
              <div>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-construction-dark">Project Management</h2>
                  <p className="mt-2 text-construction-gray">Create a project to track budget, milestones, and progress.</p>
                </div>
                <div className="max-w-xl">
                  <form onSubmit={handleProject} className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Project Title *</label>
                      <input type="text" required value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="e.g. Residential Villa Phase 1" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
                      <textarea required rows={4} value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none resize-none" placeholder="Scope of work..." />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Budget (USD) *</label>
                        <input type="number" required min={0} value={projectForm.budget} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="50000" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Location *</label>
                        <input type="text" required value={projectForm.location} onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="City / Site address" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
                        <input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Target End Date</label>
                        <input type="date" value={projectForm.endDate} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none" />
                      </div>
                    </div>
                    <button type="submit" disabled={actionLoading === "project"}
                      className="w-full flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                      {actionLoading === "project" ? "Creating..." : (<>Create Project <ArrowRight className="w-4 h-4" /></>)}
                    </button>
                    <p className="text-xs text-slate-500 text-center">You must be logged in.</p>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
