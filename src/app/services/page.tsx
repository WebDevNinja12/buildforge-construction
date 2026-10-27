"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2, MapPin, Wrench, Users, ClipboardList,
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
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    const deposit = asset.price * 0.1;
    const ok = window.confirm(
      "Confirm reservation\n\nTitle: " + asset.title + "\nType: " + asset.type + "\nLocation: " + asset.location +
      "\nPrice: " + formatCurrency(asset.price) + "\nDeposit (10%): " + formatCurrency(deposit) +
      "\n\n" + asset.description +
      "\n\nThis item will be removed from available listings.\nPay the deposit within 24 hours or the hold expires automatically."
    );
    if (!ok) return;
    setActionLoading(assetId);
    setMessage(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reservation failed");
      setMessage({ type: "success", text: data.message || "Reservation submitted!" });
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Reservation failed" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRent(e: React.FormEvent) {
    e.preventDefault();
    const tool = tools.find((t) => t.id === rentalForm.toolId);
    if (!tool) return;
    const ok = window.confirm(
      "Confirm tool rental\n\nTool: " + tool.name + "\n" + tool.description +
      "\nQty: " + rentalForm.quantity + "\nFrom " + rentalForm.startDate + " to " + rentalForm.endDate +
      "\n\nStock will be reduced immediately. Pay within 24 hours or the hold is cancelled."
    );
    if (!ok) return;
    setActionLoading("rent");
    setMessage(null);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rentalForm, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rental failed");
      setMessage({ type: "success", text: data.message || "Rental booked: " + formatCurrency(data.totalCost) });
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
    const w = workers.find((x) => x.id === hireForm.workerId);
    const ok = window.confirm(
      "Confirm hire request\n\nWorker: " + (w?.name || "Open request") +
      "\nService: " + hireForm.serviceType + "\nLocation: " + hireForm.location +
      "\nStart: " + hireForm.startDate + "\n\n" + hireForm.description +
      "\n\nPlease verify these details before continuing."
    );
    if (!ok) return;
    setActionLoading("hire");
    setMessage(null);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...hireForm, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hire request failed");
      setMessage({ type: "success", text: "Hire request submitted!" });
      setHireForm({ workerId: "", serviceType: "LABOR", description: "", location: "", startDate: "", endDate: "" });
      loadData();
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
            Preview and confirm every booking. Reserved items leave available stock immediately. Unpaid holds expire in 24 hours.
          </p>
        </div>
      </section>

      <div className="sticky top-16 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto gap-1 py-2">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap ${
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
              <Link href="/dashboard" className="ml-auto text-sm font-medium underline">Dashboard</Link>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
        ) : (
          <>
            {(activeTab === "assets" || activeTab === "land") && (
              <div>
                <h2 className="text-2xl font-bold text-construction-dark mb-2">
                  {activeTab === "land" ? "Land for Sale" : "Properties for Sale & Reservation"}
                </h2>
                <p className="text-construction-gray mb-8">Review the full description, then confirm before reserving.</p>
                {filteredAssets.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-2xl border"><Building2 className="w-12 h-12 text-slate-400 mx-auto" /><p className="mt-4 text-construction-gray">No listings available.</p></div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAssets.map((asset) => (
                      <div key={asset.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                        <div className="h-40 bg-gradient-to-br from-primary-600 to-construction-dark flex items-center justify-center">
                          <Building2 className="w-12 h-12 text-white/70" />
                        </div>
                        <div className="p-5">
                          <div className="flex justify-between gap-2">
                            <h3 className="font-semibold">{asset.title}</h3>
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{asset.type}</span>
                          </div>
                          <p className="mt-1 text-sm text-construction-gray line-clamp-3">{asset.description}</p>
                          <div className="mt-3 text-sm text-slate-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{asset.location}</div>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-lg font-bold text-accent-600">{formatCurrency(asset.price)}</span>
                            <button onClick={() => handleReserve(asset.id)} disabled={!!actionLoading}
                              className="text-sm font-medium bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg">
                              {actionLoading === asset.id ? "..." : "Preview & Reserve"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "tools" && (
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                  {tools.map((tool) => (
                    <div key={tool.id} onClick={() => setRentalForm({ ...rentalForm, toolId: tool.id })}
                      className={`p-4 rounded-xl border cursor-pointer ${rentalForm.toolId === tool.id ? "border-primary-500 bg-primary-50" : "border-slate-200"}`}>
                      <h3 className="font-semibold">{tool.name}</h3>
                      <p className="text-sm text-construction-gray mt-1">{tool.description}</p>
                      <p className="text-sm mt-2"><DollarSign className="w-3.5 h-3.5 inline" />{formatCurrency(tool.dailyRate)}/day · {tool.available} available</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleRent} className="bg-slate-50 rounded-2xl p-6 border h-fit space-y-3">
                  <h3 className="font-semibold">Book rental</h3>
                  <p className="text-sm text-slate-500">{rentalForm.toolId ? tools.find((t) => t.id === rentalForm.toolId)?.name : "Select a tool"}</p>
                  <input type="number" min={1} value={rentalForm.quantity} onChange={(e) => setRentalForm({ ...rentalForm, quantity: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border" placeholder="Qty" />
                  <input type="date" required value={rentalForm.startDate} onChange={(e) => setRentalForm({ ...rentalForm, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <input type="date" required value={rentalForm.endDate} onChange={(e) => setRentalForm({ ...rentalForm, endDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <button type="submit" disabled={!rentalForm.toolId || actionLoading === "rent"} className="w-full bg-accent-500 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50">Preview & Confirm</button>
                </form>
              </div>
            )}

            {activeTab === "workers" && (
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                  {workers.map((w) => (
                    <div key={w.id} onClick={() => setHireForm({ ...hireForm, workerId: w.id })}
                      className={`p-4 rounded-xl border cursor-pointer ${hireForm.workerId === w.id ? "border-primary-500 bg-primary-50" : "border-slate-200"}`}>
                      <h3 className="font-semibold">{w.name}</h3>
                      <p className="text-sm text-primary-600">{WORKER_SPECIALTIES.find((s) => s.value === w.specialty)?.label || w.specialty}</p>
                      <p className="text-sm text-slate-500">{w.experience} yrs · {formatCurrency(w.dailyRate)}/day</p>
                      {w.bio && <p className="text-xs text-slate-500 mt-1">{w.bio}</p>}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleHire} className="bg-slate-50 rounded-2xl p-6 border h-fit space-y-3">
                  <h3 className="font-semibold">Hire request</h3>
                  <textarea required rows={3} placeholder="Job description" value={hireForm.description} onChange={(e) => setHireForm({ ...hireForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <input required placeholder="Location" value={hireForm.location} onChange={(e) => setHireForm({ ...hireForm, location: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <input type="date" required value={hireForm.startDate} onChange={(e) => setHireForm({ ...hireForm, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <button type="submit" disabled={actionLoading === "hire"} className="w-full bg-accent-500 text-white font-semibold py-2.5 rounded-xl">Preview & Confirm</button>
                </form>
              </div>
            )}

            {activeTab === "projects" && (
              <form onSubmit={handleProject} className="max-w-xl space-y-4 bg-white border rounded-2xl p-6">
                <h2 className="text-xl font-bold">Start a project</h2>
                <input required placeholder="Title" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                <textarea required rows={3} placeholder="Description" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                <input required placeholder="Location" value={projectForm.location} onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                <input required type="number" placeholder="Budget" value={projectForm.budget} onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                <button type="submit" disabled={actionLoading === "project"} className="bg-accent-500 text-white font-semibold px-5 py-2.5 rounded-xl">Create project</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
