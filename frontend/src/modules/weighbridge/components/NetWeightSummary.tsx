/**
 * Shared "Net weight (calculated)" summary card.
 */
import React from "react";
import { AlertTriangle } from "lucide-react";
import { fmtKg } from "../format";

interface Props {
  label: string;
  net: number | null;
  firstLabel: string;
  first: number | null;
  secondLabel: string;
  second: number | null;
  /** Math operator shown between the two readings, e.g. "−" or "−" */
  operator?: string;
  /** Accent color for the big net value */
  accent?: "emerald" | "indigo" | "amber";
}

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  emerald: "text-emerald-300",
  indigo: "text-indigo-300",
  amber: "text-amber-300",
};

export function NetWeightSummary({
  label,
  net,
  firstLabel,
  first,
  secondLabel,
  second,
  operator = "−",
  accent = "emerald",
}: Props) {
  return (
    <section className="bg-slate-900 text-white rounded-xl p-5 shadow-md">
      <div className="text-[10px] font-extrabold tracking-widest uppercase text-slate-300 mb-2">
        {label}
      </div>
      <div className="flex items-end gap-3">
        <span
          className={`text-5xl font-black font-mono tabular-nums ${ACCENT[accent]}`}
        >
          {net != null ? Number(net).toLocaleString() : "—"}
        </span>
        <span className="text-sm text-slate-400 mb-1">kg</span>
      </div>
      <div className="mt-3 text-[11px] text-slate-300 flex flex-wrap gap-4">
        <span>
          {firstLabel}:{" "}
          <strong className="text-white">{first != null ? fmtKg(first) : "—"}</strong>
        </span>
        <span>{operator}</span>
        <span>
          {secondLabel}:{" "}
          <strong className="text-white">
            {second != null ? fmtKg(second) : "—"}
          </strong>
        </span>
        <span>=</span>
        <span>
          Net:{" "}
          <strong className={ACCENT[accent]}>
            {net != null ? fmtKg(net) : "—"}
          </strong>
        </span>
      </div>
      {net != null && net <= 0 && (
        <div className="mt-3 text-[11px] text-rose-300 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Net weight is non-positive.
          Check capture order.
        </div>
      )}
    </section>
  );
}
