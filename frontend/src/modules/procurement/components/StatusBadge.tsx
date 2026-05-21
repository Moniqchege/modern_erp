import React from "react";

const STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  EXPIRING_SOON: "bg-amber-100 text-amber-800",
  NON_COMPLIANT: "bg-red-100 text-red-800",
  PASSED: "bg-emerald-100 text-emerald-800",
  FAILED_CONDITIONAL: "bg-amber-100 text-amber-800",
  FULL_REJECTION: "bg-red-100 text-red-800",
  PENDING_QC: "bg-sky-100 text-sky-800",
  POSTED: "bg-emerald-100 text-emerald-800",
  MATCHED: "bg-emerald-100 text-emerald-800",
  PRICE_DISCREPANCY: "bg-orange-100 text-orange-800",
  QUANTITY_DISCREPANCY: "bg-orange-100 text-orange-800",
  BOTH_DISCREPANCY: "bg-red-100 text-red-800",
  PENDING_FINANCE: "bg-violet-100 text-violet-800",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-800",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
