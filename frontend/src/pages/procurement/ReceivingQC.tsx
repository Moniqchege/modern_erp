import React, { useEffect, useState } from "react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type { GoodsReceivedNote } from "../../modules/procurement/types/procurement";

export function ReceivingQC() {
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);

  useEffect(() => {
    void procurementApi.grns
      .list()
      .then((d) => setGrns(d.grns as GoodsReceivedNote[]))
      .catch(() => setGrns([]));
  }, []);

  const qcFailed = (g: GoodsReceivedNote) =>
    g.qcResults?.some((q) => q.status === "FULL_REJECTION") ?? false;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-900">Receiving, Weighbridge & QC</h1>
      <p className="text-xs text-slate-500 mb-6">
        GRN blocked until lab signs off moisture, aflatoxin, and grade deductions
      </p>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">GRN</th>
              <th className="px-4 py-3">Delivery #</th>
              <th className="px-4 py-3">Trace code</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {grns.map((g) => (
              <tr
                key={g.id}
                className={`border-t ${qcFailed(g) ? "bg-red-50" : g.status === "PENDING_QC" ? "bg-amber-50/50" : ""}`}
              >
                <td className="px-4 py-3 font-mono font-bold">{g.grnNumber}</td>
                <td className="px-4 py-3">{g.deliverySequence}</td>
                <td className="px-4 py-3">{g.batchTraceCode ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={g.status} />
                  {qcFailed(g) && (
                    <span className="ml-2 text-red-600 font-bold text-[10px]">QC FAIL</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
