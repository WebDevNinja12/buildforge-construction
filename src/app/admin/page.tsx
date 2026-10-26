"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, Building2, Wrench, HardHat, ClipboardList,
  Trash2, Plus, Loader2, Shield, ArrowLeft,
} from "lucide-react";

type Tab = "users" | "assets" | "tools" | "workers" | "finished";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // data
  const [users, setUsers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [finished, setFinished] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // forms
  const [userForm, setUserForm] = useState({ email: "", password: "", name: "", phone: "", role: "CLIENT" });
  const [assetForm, setAssetForm] = useState({
    title: "", description: "", type: "HOUSE", price: "", location: "", size: "", bedrooms: "", bathrooms: "",
  });
  const [toolForm, setToolForm] = useState({
    name: "", description: "", category: "POWER", dailyRate: "", weeklyRate: "", quantity: "1",
  });
  const [workerForm, setWorkerForm] = useState({
    name: "", specialty: "MASON", experience: "", dailyRate: "", rating: "4.5", bio: "",
  });
  const [fpForm, setFpForm] = useState({
    title: "", description: "", location: "", category: "RESIDENTIAL", completedAt: "", sortOrder: "0",
  });
  const [saving, setSaving] = useState(false);

  const notify = (msg: string, isError = false) => {
    if (isError) { setError(msg); setMessage(null); }
    else { setMessage(msg); setError(null); }
  };

  const loadTab = useCallback(async (t: Tab) => {
    setLoading(true);
    setError(null);
    try {
      if (t === "users") {
        const res = await fetch("/api/admin/users");
        if (res.status === 403) { setAuthorized(false); return; }
        setAuthorized(true);
        const data = await res.json();
        if (Array.isArray(data)) setUsers(data);
      } else if (t === "assets") {
        const res = await fetch("/api/assets?all=1");
        const data = await res.json();
        if (Array.isArray(data)) setAssets(data);
        setAuthorized(true);
      } else if (t === "tools") {
        const res = await fetch("/api/admin/tools");
        if (res.status === 403) { setAuthorized(false); return; }
        setAuthorized(true);
        const data = await res.json();
        if (Array.isArray(data)) setTools(data);
      } else if (t === "workers") {
        const res = await fetch("/api/admin/workers");
        if (res.status === 403) { setAuthorized(false); return; }
        setAuthorized(true);
        const data = await res.json();
        if (Array.isArray(data)) setWorkers(data);
      } else if (t === "finished") {
        const res = await fetch("/api/finished-projects");
        const data = await res.json();
        if (Array.isArray(data)) setFinished(data);
        setAuthorized(true);
      }
    } catch {
      notify("Failed to load data", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  async function deleteUser(id: string) {
    if (!confirm("Delete this customer and all their bookings?")) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Delete failed", true);
    notify("Customer deleted");
    loadTab("users");
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("User created (password stored hashed)");
      setUserForm({ email: "", password: "", name: "", phone: "", role: "CLIENT" });
      loadTab("users");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function createAsset(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...assetForm,
          price: Number(assetForm.price),
          bedrooms: assetForm.bedrooms ? Number(assetForm.bedrooms) : null,
          bathrooms: assetForm.bathrooms ? Number(assetForm.bathrooms) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("Asset / service listing added");
      setAssetForm({ title: "", description: "", type: "HOUSE", price: "", location: "", size: "", bedrooms: "", bathrooms: "" });
      loadTab("assets");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAsset(id: string) {
    if (!confirm("Delete this asset?")) return;
    const res = await fetch(`/api/assets?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return notify(data.error || "Failed", true);
    }
    notify("Asset deleted");
    loadTab("assets");
  }

  async function createTool(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...toolForm,
          dailyRate: Number(toolForm.dailyRate),
          weeklyRate: Number(toolForm.weeklyRate),
          quantity: Number(toolForm.quantity) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("Tool added");
      setToolForm({ name: "", description: "", category: "POWER", dailyRate: "", weeklyRate: "", quantity: "1" });
      loadTab("tools");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTool(id: string) {
    if (!confirm("Delete this tool?")) return;
    const res = await fetch(`/api/admin/tools?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return notify(data.error || "Failed", true);
    }
    notify("Tool deleted");
    loadTab("tools");
  }

  async function createWorker(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...workerForm,
          experience: Number(workerForm.experience),
          dailyRate: Number(workerForm.dailyRate),
          rating: Number(workerForm.rating) || 4.5,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("Worker added");
      setWorkerForm({ name: "", specialty: "MASON", experience: "", dailyRate: "", rating: "4.5", bio: "" });
      loadTab("workers");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorker(id: string) {
    if (!confirm("Delete this worker?")) return;
    const res = await fetch(`/api/admin/workers?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return notify(data.error || "Failed", true);
    }
    notify("Worker deleted");
    loadTab("workers");
  }

  async function createFinished(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/finished-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fpForm,
          sortOrder: Number(fpForm.sortOrder) || 0,
          featured: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("Finished project published");
      setFpForm({ title: "", description: "", location: "", category: "RESIDENTIAL", completedAt: "", sortOrder: "0" });
      loadTab("finished");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteFinished(id: string) {
    if (!confirm("Remove this finished project?")) return;
    const res = await fetch(`/api/finished-projects?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return notify(data.error || "Failed", true);
    }
    notify("Removed");
    loadTab("finished");
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="mt-4 text-xl font-bold text-construction-dark">Admin access required</h1>
          <p className="mt-2 text-sm text-construction-gray">Log in with an admin account to manage Hama Construction.</p>
          <Link href="/login" className="mt-6 inline-block bg-accent-500 text-white font-semibold px-5 py-2.5 rounded-xl">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "users", label: "Customers", icon: Users },
    { id: "assets", label: "Assets / Land", icon: Building2 },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "workers", label: "Workers", icon: HardHat },
    { id: "finished", label: "Finished Projects", icon: ClipboardList },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline mb-4">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-construction-dark">Admin Control</h1>
        </div>
        <p className="text-construction-gray text-sm mb-6">
          Full control: customers, service listings, tools, workers, and finished projects. All passwords are stored hashed (bcrypt).
        </p>

        {message && <p className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t.id ? "bg-primary-600 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
        ) : (
          <>
            {tab === "users" && (
              <div className="space-y-8">
                <form onSubmit={createUser} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Add user</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input required type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input required type="password" placeholder="Password (will be hashed)" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input placeholder="Phone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-slate-300" />
                    <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="px-3 py-2 rounded-lg border border-slate-300">
                      <option value="CLIENT">Client</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50">
                    {saving ? "Saving..." : "Create user"}
                  </button>
                </form>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b font-semibold">Customers ({users.length})</div>
                  <ul className="divide-y">
                    {users.map((u) => (
                      <li key={u.id} className="px-5 py-3 flex justify-between items-start gap-3">
                        <div>
                          <p className="font-medium">{u.name} <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{u.role}</span></p>
                          <p className="text-sm text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Reservations {u._count?.reservations ?? 0} · Rentals {u._count?.toolRentals ?? 0} · Hires {u._count?.hireRequests ?? 0}
                          </p>
                        </div>
                        {u.role !== "ADMIN" && (
                          <button type="button" onClick={() => deleteUser(u.id)} className="text-red-600 p-1" title="Delete customer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {tab === "assets" && (
              <div className="space-y-8">
                <form onSubmit={createAsset} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Add asset / land listing</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Title" value={assetForm.title} onChange={(e) => setAssetForm({ ...assetForm, title: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input required placeholder="Location" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <select value={assetForm.type} onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300">
                      <option value="HOUSE">House</option>
                      <option value="HOTEL">Hotel</option>
                      <option value="APARTMENT">Apartment</option>
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="LAND">Land</option>
                    </select>
                    <input required type="number" placeholder="Price" value={assetForm.price} onChange={(e) => setAssetForm({ ...assetForm, price: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input placeholder="Size" value={assetForm.size} onChange={(e) => setAssetForm({ ...assetForm, size: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input type="number" placeholder="Bedrooms" value={assetForm.bedrooms} onChange={(e) => setAssetForm({ ...assetForm, bedrooms: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                  </div>
                  <textarea required rows={2} placeholder="Description" value={assetForm.description} onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50">{saving ? "Saving..." : "Add listing"}</button>
                </form>
                <ul className="space-y-2">
                  {assets.map((a) => (
                    <li key={a.id} className="bg-white rounded-xl border px-4 py-3 flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{a.title} <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{a.type}</span></p>
                        <p className="text-sm text-slate-500">{a.location} · ${Number(a.price).toLocaleString()} · {a.status}</p>
                      </div>
                      <button type="button" onClick={() => deleteAsset(a.id)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "tools" && (
              <div className="space-y-8">
                <form onSubmit={createTool} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Add tool</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Name" value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <select value={toolForm.category} onChange={(e) => setToolForm({ ...toolForm, category: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300">
                      <option value="POWER">Power</option>
                      <option value="HAND">Hand</option>
                      <option value="HEAVY">Heavy</option>
                      <option value="SAFETY">Safety</option>
                    </select>
                    <input required type="number" placeholder="Daily rate" value={toolForm.dailyRate} onChange={(e) => setToolForm({ ...toolForm, dailyRate: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input required type="number" placeholder="Weekly rate" value={toolForm.weeklyRate} onChange={(e) => setToolForm({ ...toolForm, weeklyRate: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input type="number" placeholder="Quantity" value={toolForm.quantity} onChange={(e) => setToolForm({ ...toolForm, quantity: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                  </div>
                  <textarea required rows={2} placeholder="Description" value={toolForm.description} onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50">{saving ? "Saving..." : "Add tool"}</button>
                </form>
                <ul className="space-y-2">
                  {tools.map((t) => (
                    <li key={t.id} className="bg-white rounded-xl border px-4 py-3 flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-sm text-slate-500">{t.category} · ${t.dailyRate}/day · qty {t.available}/{t.quantity}</p>
                      </div>
                      <button type="button" onClick={() => deleteTool(t.id)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "workers" && (
              <div className="space-y-8">
                <form onSubmit={createWorker} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Add worker</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Name" value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <select value={workerForm.specialty} onChange={(e) => setWorkerForm({ ...workerForm, specialty: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300">
                      <option value="MASON">Mason</option>
                      <option value="ELECTRICIAN">Electrician</option>
                      <option value="PLUMBER">Plumber</option>
                      <option value="CARPENTER">Carpenter</option>
                      <option value="GENERAL">General</option>
                      <option value="SUPERVISOR">Supervisor</option>
                    </select>
                    <input required type="number" placeholder="Years experience" value={workerForm.experience} onChange={(e) => setWorkerForm({ ...workerForm, experience: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input required type="number" placeholder="Daily rate" value={workerForm.dailyRate} onChange={(e) => setWorkerForm({ ...workerForm, dailyRate: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                  </div>
                  <textarea rows={2} placeholder="Bio" value={workerForm.bio} onChange={(e) => setWorkerForm({ ...workerForm, bio: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50">{saving ? "Saving..." : "Add worker"}</button>
                </form>
                <ul className="space-y-2">
                  {workers.map((w) => (
                    <li key={w.id} className="bg-white rounded-xl border px-4 py-3 flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="text-sm text-slate-500">{w.specialty} · {w.experience} yrs · ${w.dailyRate}/day</p>
                      </div>
                      <button type="button" onClick={() => deleteWorker(w.id)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "finished" && (
              <div className="space-y-8">
                <form onSubmit={createFinished} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Add finished project</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Title" value={fpForm.title} onChange={(e) => setFpForm({ ...fpForm, title: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <input required placeholder="Location" value={fpForm.location} onChange={(e) => setFpForm({ ...fpForm, location: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                    <select value={fpForm.category} onChange={(e) => setFpForm({ ...fpForm, category: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300">
                      <option value="RESIDENTIAL">Residential</option>
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="INDUSTRIAL">Industrial</option>
                      <option value="INFRASTRUCTURE">Infrastructure</option>
                    </select>
                    <input required type="date" value={fpForm.completedAt} onChange={(e) => setFpForm({ ...fpForm, completedAt: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-300" />
                  </div>
                  <textarea required rows={2} placeholder="Description" value={fpForm.description} onChange={(e) => setFpForm({ ...fpForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50">{saving ? "Saving..." : "Publish"}</button>
                </form>
                <ul className="space-y-2">
                  {finished.map((p) => (
                    <li key={p.id} className="bg-white rounded-xl border px-4 py-3 flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-sm text-slate-500">{p.location} · {p.category}</p>
                      </div>
                      <button type="button" onClick={() => deleteFinished(p.id)} className="text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
