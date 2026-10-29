"use client";

import { AdminClearHistory } from "@/components/AdminClearHistory";

/** Mount at top of Activity tab */
export function ActivityExtras({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="space-y-4 mb-4">
      <AdminClearHistory onCleared={onRefresh} />
    </div>
  );
}
