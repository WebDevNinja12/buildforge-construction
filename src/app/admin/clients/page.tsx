"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { statusBadgeClass } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export default function AdminClientsPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json().catch(() => []);
      setUsers(Array.isArray(data) ? data : data?.users || []);
    } catch {
      setUsers([]);
      toast("Failed to load clients", "err");
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
    if (!res.ok) toast(data.error || "Failed", "err");
    else {
      toast("Saved");
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
      toast(data.error || "Delete failed", "err");
      return;
    }
    toast("Client removed");
    load();
  }

  const filtered = users.filter((u) => {
    if (u?.role === "ADMIN") return false;
    const st = (u?.status || "").toUpperCase();
    const vs = (u?.verificationStatus || "").toUpperCase();
    if (filter === "UNDER_REVIEW") {
      if (!["UNDER_REVIEW", "PENDING", "PENDING_APPROVAL"].includes(st) && vs !== "UNDER_REVIEW")
        return false;
    }
    if (filter === "VERIFIED" && vs !== "VERIFIED") return false;
    if (filter === "SUSPENDED" && st !== "SUSPENDED") return false;
    if (q) {
      const s = q.toLowerCase();
      return (
        u?.name?.toLowerCase().includes(s) ||
        u?.email?.toLowerCase().includes(s) ||
        u?.phone?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const Actions = ({ u }: { u: any }) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="min-h-[44px] text-xs font-semibold bg-green-600 text-white px-3 py-2 rounded-lg" onClick={() => patch(u.id, { status: "APPROVED" })}>
        Approve
      </button>
      <button type="button" className="min-h-[44px] text-xs font-semibold bg-primary-600 text-white px-3 py-2 rounded-lg" onClick={() => patch(u.id, { action: "FINAL_VERIFY" })}>
        Verify
      </button>
      <button type="button" className="min-h-[44px] text-xs font-semibold border px-3 py-2 rounded-lg" onClick={() => patch(u.id, { status: "SUSPENDED" })}>
        Suspend
      </button>
      <button type="button" className="min-h-[44px] text-xs font-semibold text-red-600 border border-red-200 px-3 py-2 rounded-lg" onClick={() => remove(u.id)}>
        Remove
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Clients</h1>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone"
            className="w-full border rounded-xl pl-9 pr-3 min-h-[44px] text-sm"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-xl px-3 min-h-[44px] text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="VERIFIED">Verified</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-6">No data yet.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((u) => (
              <div key={u.id} className="bg-white border rounded-2xl p-4 space-y-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-semibold">{u?.name || "—"}</p>
                    <p className="text-sm text-slate-500 break-all">{u?.email}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full h-fit ${statusBadgeClass(u?.verificationStatus || u?.status)}`}>
                    {(u?.verificationStatus || u?.status || "").replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Account: {u?.status}</p>
                <Actions u={u} />
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border rounded-2xl overflow-x-auto">
            <p className="text-[11px] text-slate-400 px-4 pt-2 md:hidden">Swipe horizontally for more →</p>
            <table className="min-w-[720px] w-full text-sm">
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
                    <td className="px-4 py-3 font-medium">{u?.name}</td>
                    <td className="px-4 py-3">{u?.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(u?.status)}`}>
                        {u?.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(u?.verificationStatus)}`}>
                        {u?.verificationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Actions u={u} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
