import React, { useEffect, useState } from "react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type { PurchaseOrder } from "../../modules/procurement/types/procurement";

export function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    void procurementApi.purchaseOrders
      .list()
      .then((d) => setOrders(d.purchaseOrders as PurchaseOrder[]))
      .catch(() => setOrders([]));
  }, []);

  const overdue = (po: PurchaseOrder) => {
    if (!po.expectedDelivery) return false;
    return new Date(po.expectedDelivery) < new Date() && po.status === "ISSUED";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-900">Purchase Orders</h1>
      <p className="text-xs text-slate-500 mb-6">Multi-currency POs • split deliveries • PDF export (API hook)</p>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">PO</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => (
              <tr
                key={po.id}
                className={`border-t ${overdue(po) ? "bg-red-50" : ""}`}
              >
                <td className="px-4 py-3 font-mono font-bold">{po.poNumber}</td>
                <td className="px-4 py-3">{po.supplier?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  {po.currency} {Number(po.totalAmount).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={po.status} />
                  {overdue(po) && (
                    <span className="ml-2 text-[10px] text-red-600 font-bold">OVERDUE</span>
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
