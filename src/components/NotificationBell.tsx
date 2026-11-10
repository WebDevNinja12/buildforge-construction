"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type?: string | null;
  createdAt: string;
};

/** Mobile-friendly SVG notification control for dashboard pages. */
export function NotificationBell({ light = false }: { light?: boolean }) {
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
    function onDoc(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  const btnClass = light
    ? "relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/15 hover:bg-white/25 text-white shadow-sm backdrop-blur-sm"
    : "relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border-2 border-primary-200 bg-white hover:bg-primary-50 text-primary-700 shadow-sm";

  return (
    <div className="relative z-20" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        className={btnClass}
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
      >
        <Bell className="w-5 h-5" strokeWidth={2} aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/40 sm:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />

          <div
            className={cn(
              "z-[100] bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col",
              "fixed inset-x-0 bottom-0 max-h-[min(75vh,32rem)] rounded-t-2xl",
              "sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:bottom-auto sm:left-auto",
              "sm:w-[min(22rem,calc(100vw-2rem))] sm:max-h-96 sm:rounded-2xl"
            )}
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-3 border-b bg-slate-50 shrink-0">
              <p className="text-sm font-semibold text-construction-dark inline-flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-primary-600" aria-hidden />
                Notifications
                {unread > 0 && (
                  <span className="ml-1 text-[11px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">
                    {unread}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={loading || unread === 0}
                  onClick={markAll}
                  className="text-[11px] font-medium text-primary-600 disabled:opacity-40 inline-flex items-center gap-1 min-h-[40px] px-2 rounded-lg hover:bg-primary-50"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" aria-hidden />
                  )}
                  <span>Read all</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:hidden"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
              {items.length === 0 ? (
                <p className="text-sm text-slate-500 p-6 text-center">No notifications yet.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => !n.read && markOne(n.id)}
                    className={cn(
                      "w-full text-left px-3 py-3 border-b border-slate-100 hover:bg-slate-50 active:bg-slate-100",
                      !n.read && "bg-sky-50/70"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        !n.read ? "font-semibold text-construction-dark" : "font-medium text-slate-700"
                      )}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-3 leading-relaxed">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="pb-[env(safe-area-inset-bottom,0px)] sm:hidden shrink-0" />
          </div>
        </>
      )}
    </div>
  );
}
