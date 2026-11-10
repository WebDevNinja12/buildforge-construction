"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type?: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unreadCount || 0));
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markAll() {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "READ_ALL" }),
      });
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function markOne(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "READ" }),
    });
    await load();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border-2 border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-700 shadow-sm"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b bg-slate-50">
            <p className="text-sm font-semibold text-construction-dark">Notifications</p>
            <button
              type="button"
              disabled={loading || unread === 0}
              onClick={markAll}
              className="text-[11px] font-medium text-primary-600 disabled:opacity-40 inline-flex items-center gap-1"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-slate-500 p-4 text-center">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.read && markOne(n.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50",
                    !n.read && "bg-sky-50/60"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm",
                      !n.read ? "font-semibold text-construction-dark" : "font-medium text-slate-700"
                    )}
                  >
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
