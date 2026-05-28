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
      .catch(() => setOrders([])); // Fixed: changed from setRows to setOrders
  }, []);

  const overdue = (po: PurchaseOrder) => {
    if (!po.expectedDelivery) return false;
    return new Date(po.expectedDelivery) < new Date() && po.status === "ISSUED";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-900">Purchase Orders</h1>
      <p className="text-xs text-slate-500 mb-6">Multi-currency POs • split deliveries • PDF export (API hook)</p>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 uppercase text-slate-500 font-semibold tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">PO Number</th>
              <th className="px-4 py-3">Expected Delivery</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">Sub-total</th>
              <th className="px-4 py-3 text-right">VAT (16%)</th>
              <th className="px-4 py-3 text-right">Total PO</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((po) => {
              // Safely derive tax fields from totalAmount using standard KRA 16% VAT arithmetic
              const totalAmount = Number(po.totalAmount) || 0;
              const subtotal = totalAmount / 1.16;
              const vatAmount = totalAmount - subtotal;

              return (
                <tr
                  key={po.id}
                  className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                    overdue(po) ? "bg-red-50/60" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{po.poNumber}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString("en-KE") : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {po.supplier?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {po.currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {po.currency} {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {po.currency} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <StatusBadge status={po.status} />
                      {overdue(po) && (
                        <span className="inline-block bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold tracking-wide animate-pulse">
                          OVERDUE
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                  No purchase orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
