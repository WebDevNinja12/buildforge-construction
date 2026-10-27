"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, Building2, Wrench, HardHat, ClipboardList, Activity,
  Trash2, Plus, Loader2, Shield, ArrowLeft, Check, X,
} from "lucide-react";

type Tab = "users" | "activity" | "assets" | "tools" | "workers" | "finished";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [finished, setFinished] = useState<any[]>([]);
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userForm, setUserForm] = useState({ email: "", password: "", name: "", phone: "", role: "CLIENT" });
  const [assetForm, setAssetForm] = useState({ title: "", description: "", type: "HOUSE", price: "", location: "", size: "" });
  const [toolForm, setToolForm] = useState({ name: "", description: "", category: "POWER", dailyRate: "", weeklyRate: "", quantity: "1" });
  const [workerForm, setWorkerForm] = useState({ name: "", specialty: "MASON", experience: "", dailyRate: "", bio: "" });
  const [fpForm, setFpForm] = useState({ title: "", description: "", location: "", category: "RESIDENTIAL", completedAt: "" });

  const notify = (msg: string, isError = false) => {
    if (isError) { setError(msg); setMessage(null); } else { setMessage(msg); setError(null); }
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
      } else if (t === "activity") {
        const res = await fetch("/api/admin/activity");
        if (res.status === 403) { setAuthorized(false); return; }
        setAuthorized(true);
        setActivity(await res.json());
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

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  async function deleteUser(id: string) {
    if (!confirm("Delete this customer and all their bookings?")) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Delete failed", true);
    notify("Customer deleted");
    loadTab("users");
  }

  async function setUserStatus(id: string, status: string) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Update failed", true);
    notify(status === "APPROVED" ? "Client approved" : `Status: ${status}`);
    loadTab("users");
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...userForm, status: "APPROVED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("User created (password hashed, pre-approved)");
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
        body: JSON.stringify({ ...assetForm, price: Number(assetForm.price) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("Listing added");
      setAssetForm({ title: "", description: "", type: "HOUSE", price: "", location: "", size: "" });
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
    if (!res.ok) return notify((await res.json()).error || "Failed", true);
    notify("Deleted");
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
    if (!confirm("Delete tool?")) return;
    const res = await fetch(`/api/admin/tools?id=${id}`, { method: "DELETE" });
    if (!res.ok) return notify((await res.json()).error || "Failed", true);
    notify("Deleted");
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("Worker added");
      setWorkerForm({ name: "", specialty: "MASON", experience: "", dailyRate: "", bio: "" });
      loadTab("workers");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteWorker(id: string) {
    if (!confirm("Delete worker?")) return;
    const res = await fetch(`/api/admin/workers?id=${id}`, { method: "DELETE" });
    if (!res.ok) return notify((await res.json()).error || "Failed", true);
    notify("Deleted");
    loadTab("workers");
  }

  async function createFinished(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/finished-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fpForm, featured: true, sortOrder: 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      notify("Published");
      setFpForm({ title: "", description: "", location: "", category: "RESIDENTIAL", completedAt: "" });
      loadTab("finished");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed", true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteFinished(id: string) {
    if (!confirm("Remove?")) return;
    const res = await fetch(`/api/finished-projects?id=${id}`, { method: "DELETE" });
    if (!res.ok) return notify((await res.json()).error || "Failed", true);
    notify("Removed");
    loadTab("finished");
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border p-8 max-w-md text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h1 className="mt-4 text-xl font-bold">Admin access required</h1>
          <Link href="/login" className="mt-6 inline-block bg-accent-500 text-white font-semibold px-5 py-2.5 rounded-xl">Login</Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "users", label: "Customers", icon: Users },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "assets", label: "Assets / Land", icon: Building2 },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "workers", label: "Workers", icon: HardHat },
    { id: "finished", label: "Finished Projects", icon: ClipboardList },
  ];

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline mb-4">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-construction-dark flex items-center gap-2">
          <Shield className="w-8 h-8 text-primary-600" /> Admin Control
        </h1>
        <p className="text-sm text-construction-gray mb-6">Oversee clients, approvals, bookings, and services. Passwords are bcrypt-hashed.</p>
        {message && <p className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
                tab === t.id ? "bg-primary-600 text-white" : "bg-white border border-slate-200"
              }`}>
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
                <form onSubmit={createUser} className="bg-white rounded-2xl border p-6 space-y-3">
                  <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Add client (pre-approved)</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input required type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input required type="password" placeholder="Password (hashed)" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input placeholder="Phone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} className="px-3 py-2 rounded-lg border" />
                  </div>
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl disabled:opacity-50">{saving ? "Saving..." : "Create user"}</button>
                </form>
                <div className="bg-white rounded-2xl border overflow-hidden">
                  <div className="px-5 py-3 border-b font-semibold">All customers ({users.length})</div>
                  <ul className="divide-y">
                    {users.map((u) => (
                      <li key={u.id} className="px-5 py-3 flex justify-between gap-3">
                        <div>
                          <p className="font-medium">{u.name}{" "}
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{u.role}</span>{" "}
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              u.status === "APPROVED" ? "bg-green-100 text-green-700" :
                              u.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}>{u.status || "PENDING_APPROVAL"}</span>
                          </p>
                          <p className="text-sm text-slate-500">{u.email}</p>
                          <p className="text-xs text-slate-400">Res {u._count?.reservations ?? 0} · Rent {u._count?.toolRentals ?? 0} · Hire {u._count?.hireRequests ?? 0}</p>
                        </div>
                        {u.role !== "ADMIN" && (
                          <div className="flex gap-1">
                            {u.status !== "APPROVED" && (
                              <button type="button" onClick={() => setUserStatus(u.id, "APPROVED")} className="text-green-600 p-1" title="Approve"><Check className="w-4 h-4" /></button>
                            )}
                            {u.status !== "REJECTED" && (
                              <button type="button" onClick={() => setUserStatus(u.id, "REJECTED")} className="text-amber-600 p-1" title="Reject"><X className="w-4 h-4" /></button>
                            )}
                            <button type="button" onClick={() => deleteUser(u.id)} className="text-red-600 p-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {tab === "activity" && activity && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border p-4"><p className="text-2xl font-bold text-amber-600">{activity.pendingApprovals ?? 0}</p><p className="text-sm text-slate-500">Pending approvals</p></div>
                  <div className="bg-white rounded-xl border p-4"><p className="text-2xl font-bold">{activity.reservations?.length ?? 0}</p><p className="text-sm text-slate-500">Reservations (recent)</p></div>
                  <div className="bg-white rounded-xl border p-4"><p className="text-2xl font-bold">{activity.payments?.length ?? 0}</p><p className="text-sm text-slate-500">Payments (recent)</p></div>
                </div>
                {["reservations", "rentals", "hires"].map((key) => (
                  <div key={key} className="bg-white rounded-2xl border overflow-hidden">
                    <div className="px-5 py-3 border-b font-semibold capitalize">{key}</div>
                    <ul className="divide-y max-h-64 overflow-y-auto">
                      {(activity[key] || []).map((row: any) => (
                        <li key={row.id} className="px-5 py-2 text-sm">
                          <span className="font-medium">{row.user?.name}</span>
                          {" · "}
                          {row.asset?.title || row.tool?.name || row.description?.slice(0, 40)}
                          {" · "}
                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{row.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {tab === "assets" && (
              <div className="space-y-6">
                <form onSubmit={createAsset} className="bg-white rounded-2xl border p-6 space-y-3">
                  <h2 className="font-semibold">Add asset / land</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Title" value={assetForm.title} onChange={(e) => setAssetForm({ ...assetForm, title: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input required placeholder="Location" value={assetForm.location} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <select value={assetForm.type} onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })} className="px-3 py-2 rounded-lg border">
                      <option value="HOUSE">House</option><option value="HOTEL">Hotel</option><option value="APARTMENT">Apartment</option><option value="LAND">Land</option><option value="COMMERCIAL">Commercial</option>
                    </select>
                    <input required type="number" placeholder="Price" value={assetForm.price} onChange={(e) => setAssetForm({ ...assetForm, price: e.target.value })} className="px-3 py-2 rounded-lg border" />
                  </div>
                  <textarea required rows={2} placeholder="Description" value={assetForm.description} onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl">{saving ? "..." : "Add"}</button>
                </form>
                <ul className="space-y-2">{assets.map((a) => (
                  <li key={a.id} className="bg-white border rounded-xl px-4 py-3 flex justify-between">
                    <div><p className="font-medium">{a.title}</p><p className="text-sm text-slate-500">{a.location} · {a.status}</p></div>
                    <button type="button" onClick={() => deleteAsset(a.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}</ul>
              </div>
            )}

            {tab === "tools" && (
              <div className="space-y-6">
                <form onSubmit={createTool} className="bg-white rounded-2xl border p-6 space-y-3">
                  <h2 className="font-semibold">Add tool</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Name" value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input required type="number" placeholder="Daily rate" value={toolForm.dailyRate} onChange={(e) => setToolForm({ ...toolForm, dailyRate: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input required type="number" placeholder="Weekly rate" value={toolForm.weeklyRate} onChange={(e) => setToolForm({ ...toolForm, weeklyRate: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input type="number" placeholder="Qty" value={toolForm.quantity} onChange={(e) => setToolForm({ ...toolForm, quantity: e.target.value })} className="px-3 py-2 rounded-lg border" />
                  </div>
                  <textarea required rows={2} placeholder="Description" value={toolForm.description} onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl">Add tool</button>
                </form>
                <ul className="space-y-2">{tools.map((t) => (
                  <li key={t.id} className="bg-white border rounded-xl px-4 py-3 flex justify-between">
                    <div><p className="font-medium">{t.name}</p><p className="text-sm text-slate-500">avail {t.available}/{t.quantity}</p></div>
                    <button type="button" onClick={() => deleteTool(t.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}</ul>
              </div>
            )}

            {tab === "workers" && (
              <div className="space-y-6">
                <form onSubmit={createWorker} className="bg-white rounded-2xl border p-6 space-y-3">
                  <h2 className="font-semibold">Add worker</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Name" value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <select value={workerForm.specialty} onChange={(e) => setWorkerForm({ ...workerForm, specialty: e.target.value })} className="px-3 py-2 rounded-lg border">
                      <option value="MASON">Mason</option><option value="ELECTRICIAN">Electrician</option><option value="PLUMBER">Plumber</option><option value="CARPENTER">Carpenter</option><option value="SUPERVISOR">Supervisor</option>
                    </select>
                    <input required type="number" placeholder="Experience years" value={workerForm.experience} onChange={(e) => setWorkerForm({ ...workerForm, experience: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input required type="number" placeholder="Daily rate" value={workerForm.dailyRate} onChange={(e) => setWorkerForm({ ...workerForm, dailyRate: e.target.value })} className="px-3 py-2 rounded-lg border" />
                  </div>
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl">Add worker</button>
                </form>
                <ul className="space-y-2">{workers.map((w) => (
                  <li key={w.id} className="bg-white border rounded-xl px-4 py-3 flex justify-between">
                    <div><p className="font-medium">{w.name}</p><p className="text-sm text-slate-500">{w.specialty}</p></div>
                    <button type="button" onClick={() => deleteWorker(w.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}</ul>
              </div>
            )}

            {tab === "finished" && (
              <div className="space-y-6">
                <form onSubmit={createFinished} className="bg-white rounded-2xl border p-6 space-y-3">
                  <h2 className="font-semibold">Add finished project</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Title" value={fpForm.title} onChange={(e) => setFpForm({ ...fpForm, title: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input required placeholder="Location" value={fpForm.location} onChange={(e) => setFpForm({ ...fpForm, location: e.target.value })} className="px-3 py-2 rounded-lg border" />
                    <input required type="date" value={fpForm.completedAt} onChange={(e) => setFpForm({ ...fpForm, completedAt: e.target.value })} className="px-3 py-2 rounded-lg border" />
                  </div>
                  <textarea required rows={2} placeholder="Description" value={fpForm.description} onChange={(e) => setFpForm({ ...fpForm, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border" />
                  <button type="submit" disabled={saving} className="bg-accent-500 text-white font-semibold px-4 py-2 rounded-xl">Publish</button>
                </form>
                <ul className="space-y-2">{finished.map((p) => (
                  <li key={p.id} className="bg-white border rounded-xl px-4 py-3 flex justify-between">
                    <div><p className="font-medium">{p.title}</p><p className="text-sm text-slate-500">{p.location}</p></div>
                    <button type="button" onClick={() => deleteFinished(p.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}</ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
