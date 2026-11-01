"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

export default function AdminClientsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.error || "Failed");
    else {
      setMsg("Updated");
      load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this client? Details will be wiped; same email blocked 72h.")) return;
    const res = await fetch(`/api/admin/users?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error || "Delete failed");
      return;
    }
    setMsg("Client removed");
    load();
  }

  const filtered = users.filter((u) => {
    if (u.role === "ADMIN") return false;
    if (filter === "UNDER_REVIEW" && !["UNDER_REVIEW", "PENDING", "PENDING_APPROVAL"].includes(u.status) && u.verificationStatus !== "UNDER_REVIEW")
      return false;
    if (filter === "VERIFIED" && u.verificationStatus !== "VERIFIED") return false;
    if (filter === "SUSPENDED" && u.status !== "SUSPENDED") return false;
    if (q) {
      const s = q.toLowerCase();
      return (
        u.name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.phone?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Clients</h1>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone"
            className="w-full border rounded-xl pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="VERIFIED">Verified</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Verification</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.status}</td>
                  <td className="px-4 py-3">{u.verificationStatus}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg"
                        onClick={() => patch(u.id, { status: "APPROVED" })}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="text-xs bg-primary-600 text-white px-2 py-1 rounded-lg"
                        onClick={() => patch(u.id, { action: "FINAL_VERIFY" })}
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        className="text-xs border px-2 py-1 rounded-lg"
                        onClick={() => patch(u.id, { status: "SUSPENDED" })}
                      >
                        Suspend
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded-lg"
                        onClick={() => remove(u.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-6 text-sm text-slate-500">No clients found.</p>
          )}
        </div>
      )}
    </div>
  );
}
