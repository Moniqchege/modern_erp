import React, { useEffect, useState } from "react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type { PurchaseRequisition } from "../../modules/procurement/types/procurement";

export function Requisitions() {
  const [rows, setRows] = useState<PurchaseRequisition[]>([]);

  useEffect(() => {
    void procurementApi.requisitions
      .list()
      .then((d) => setRows(d.requisitions as PurchaseRequisition[]))
      .catch(() => setRows([]));
  }, []);

  const rowClass = (status: string) => {
    if (status === "REJECTED") return "bg-red-50/50";
    if (status.startsWith("PENDING")) return "bg-amber-50/40";
    return "";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-900">Purchase Requisitions</h1>
      <p className="text-xs text-slate-500 mb-6">Low-stock auto-gen • plant manual • multi-level approval</p>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">No.</th>
              <th className="px-4 py-3">Requested by</th>
              <th className="px-4 py-3">Est. total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t ${rowClass(r.status)}`}>
                <td className="px-4 py-3 font-mono font-bold">{r.requisitionNo}</td>
                <td className="px-4 py-3">{r.requestedBy}</td>
                <td className="px-4 py-3">
                  {r.currency} {Number(r.estimatedTotal).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No requisitions yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
