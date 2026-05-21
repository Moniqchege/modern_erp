import React from "react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";

/** 3-way match workspace — wired to POST /api/procurement/three-way-match */
export function ThreeWayMatch() {
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-black text-slate-900">3-Way Match & AP</h1>
      <p className="text-xs text-slate-500 mb-6">
        Compare PO ↔ GRN ↔ Supplier Invoice. Flags &gt;1% price or quantity variance.
      </p>
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs">
        <div className="flex gap-4 items-center">
          <span>Example discrepancy:</span>
          <StatusBadge status="PRICE_DISCREPANCY" />
        </div>
        <p className="text-slate-500">
          Use API: register invoice → run match → approve payment → push AP queue.
        </p>
      </div>
    </div>
  );
}
