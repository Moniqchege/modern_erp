import React from "react";

const STYLES: Record<string, string> = {
  // generic
  ACTIVE: "border-emerald-200 text-emerald-700",
  INACTIVE: "border-slate-200 text-slate-500",
  LOCKED: "border-indigo-200 text-indigo-700",

  // supplier onboarding
  APPROVED: "border-emerald-200 text-emerald-700",
  PENDING: "border-amber-200 text-amber-700",
  REJECTED: "border-red-200 text-red-700",
  SUSPENDED: "border-orange-200 text-orange-700",

  // compliance docs
  EXPIRING_SOON: "border-amber-200 text-amber-700",
  NON_COMPLIANT: "border-red-200 text-red-700",

  // QC
  PASSED: "border-emerald-200 text-emerald-700",
  FAILED_CONDITIONAL: "border-amber-200 text-amber-700",
  FULL_REJECTION: "border-red-200 text-red-700",
  PENDING_QC: "border-sky-200 text-sky-700",

  // GRN / PO
  POSTED: "border-emerald-200 text-emerald-700",
  PARTIALLY_RECEIVED: "border-amber-200 text-amber-700",
  FULLY_RECEIVED: "border-emerald-200 text-emerald-700",
  ISSUED: "border-sky-200 text-sky-700",
  DRAFT: "border-slate-200 text-slate-500",
  CANCELLED: "border-slate-200 text-slate-400",
  CLOSED: "border-slate-200 text-slate-500",

  // Stock transfers
  APPROVED_IN_TRANSIT: "border-blue-200 text-blue-700",
  RECEIPT_REJECTED: "border-orange-200 text-orange-700",
  PENDING_CORRECTION: "border-orange-200 text-orange-700",

  // requisition lifecycle
  PENDING_HEAD_PROCUREMENT: "border-amber-200 text-amber-700",
  PENDING_FINANCE: "border-violet-200 text-violet-700",
  CONVERTED_TO_PO: "border-indigo-200 text-indigo-700",

  // 3-way match
  MATCHED: "border-emerald-200 text-emerald-700",
  PRICE_DISCREPANCY: "border-orange-200 text-orange-700",
  QUANTITY_DISCREPANCY: "border-orange-200 text-orange-700",
  BOTH_DISCREPANCY: "border-red-200 text-red-700",
  APPROVED_FOR_PAYMENT: "border-emerald-200 text-emerald-700",
};

export function StatusBadge({ status }: { status: string }) {
  const colorCls = STYLES[status] ?? "border-slate-900 text-slate-200";
  
  return (
    <span className={`inline-flex items-center px-5 py-0.5 rounded-full border bg-slate-50/50 text-[10px] font-bold uppercase tracking-wide ${colorCls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
