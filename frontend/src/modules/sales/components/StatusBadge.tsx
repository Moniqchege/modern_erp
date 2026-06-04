import React from "react";

const STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 text-emerald-700",
  INACTIVE: "border-slate-200 text-slate-500",
  SUSPENDED: "border-orange-200 text-orange-700",
  DRAFT: "border-slate-200 text-slate-500",
  CONFIRMED: "border-sky-200 text-sky-700",
  FULFILLED: "border-emerald-200 text-emerald-700",
  CANCELLED: "border-red-200 text-red-600",
  PENDING: "border-amber-200 text-amber-700",
  LOADING: "border-violet-200 text-violet-700",
  DISPATCHED: "border-indigo-200 text-indigo-700",
  DELIVERED: "border-emerald-200 text-emerald-800",
  LOADED: "border-violet-200 text-violet-700",
  IN_TRANSIT: "border-indigo-200 text-indigo-700",
  ISSUED: "border-sky-200 text-sky-700",
  PARTIAL: "border-amber-200 text-amber-700",
  PAID: "border-emerald-200 text-emerald-700",
  VOID: "border-slate-200 text-slate-400",
  OVERDUE: "border-red-200 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  const colorCls = STYLES[status] ?? "border-slate-200 text-slate-600";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border bg-white text-[10px] font-bold uppercase tracking-wide ${colorCls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
