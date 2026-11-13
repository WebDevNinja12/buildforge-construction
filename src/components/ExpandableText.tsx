"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  text: string;
  /** Character threshold before collapsing. Default 180. */
  limit?: number;
  className?: string;
  /** Optional label above the text */
  label?: string;
};

/**
 * Truncates long copy with a professional Show more / Show less control + chevron icons.
 */
export function ExpandableText({ text, limit = 180, className = "", label }: Props) {
  const [open, setOpen] = useState(false);
  const full = String(text || "").trim();
  const needsToggle = useMemo(() => full.length > limit, [full, limit]);

  if (!full) return null;

  const shown =
    !needsToggle || open
      ? full
      : full.slice(0, limit).replace(/\s+\S*$/, "") + "…";

  return (
    <div className={className}>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
          {label}
        </p>
      )}
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{shown}</p>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800 transition min-h-[32px]"
          aria-expanded={open}
        >
          {open ? (
            <>
              Show less
              <ChevronUp className="w-3.5 h-3.5" aria-hidden />
            </>
          ) : (
            <>
              Show more
              <ChevronDown className="w-3.5 h-3.5" aria-hidden />
            </>
          )}
        </button>
      )}
    </div>
  );
}
