import React from "react";

const STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 text-emerald-700",
  EXPIRING_SOON: "border-amber-200 text-amber-700",
  NON_COMPLIANT: "border-red-200 text-red-700",
  PASSED: "border-emerald-200 text-emerald-700",
  FAILED_CONDITIONAL: "border-amber-200 text-amber-700",
  FULL_REJECTION: "border-red-200 text-red-700",
  PENDING_QC: "border-sky-200 text-sky-700",
  POSTED: "border-emerald-200 text-emerald-700",
  MATCHED: "border-emerald-200 text-emerald-700",
  PRICE_DISCREPANCY: "border-orange-200 text-orange-700",
  QUANTITY_DISCREPANCY: "border-orange-200 text-orange-700",
  BOTH_DISCREPANCY: "border-red-200 text-red-700",
  PENDING_FINANCE: "border-violet-200 text-violet-700",
  PARTIALLY_RECEIVED: "border-amber-200 text-amber-700",
};

export function StatusBadge({ status }: { status: string }) {
  const colorCls = STYLES[status] ?? "border-slate-900 text-slate-200";
  
  return (
    <span className={`inline-flex items-center px-5 py-0.5 rounded-full border bg-slate-50/50 text-[10px] font-bold uppercase tracking-wide ${colorCls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
