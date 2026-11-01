"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastItem = { id: number; message: string; type: "ok" | "err" };

const ToastCtx = createContext<{
  toast: (message: string, type?: "ok" | "err") => void;
}>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 lg:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg border ${
              t.type === "err"
                ? "bg-red-600 text-white border-red-700"
                : "bg-construction-dark text-white border-slate-800"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
