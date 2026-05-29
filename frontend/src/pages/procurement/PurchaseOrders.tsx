import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Loader2 } from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { ROUTES } from "../../app/router/routes";
import type { PurchaseOrder } from "../../modules/procurement/types/procurement";

const rowBg = (po: PurchaseOrder) => {
  if (po.status === "CANCELLED") return "bg-slate-50/60 opacity-60";
  if (po.status === "FULLY_RECEIVED" || po.status === "CLOSED") return "bg-emerald-50/30";
  if (isOverdue(po)) return "bg-red-50/50";
  if (po.status === "ISSUED") return "bg-sky-50/30";
  return "";
};

function isOverdue(po: PurchaseOrder) {
  if (!po.expectedDelivery) return false;
  return new Date(po.expectedDelivery) < new Date() && po.status === "ISSUED";
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtMoney = (v: string | number, currency: string) => {
  const n = Number(v) || 0;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function PurchaseOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void procurementApi.purchaseOrders
      .list()
      .then((d) => setOrders(d.purchaseOrders as PurchaseOrder[]))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900">Purchase Orders</h1>
        <p className="text-xs text-slate-500 mt-1">
          Multi-currency · split deliveries · issue &amp; cancel from the detail view
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 uppercase text-slate-500 font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Expected Delivery</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">VAT (16%)</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => {
                const total = Number(po.totalAmount) || 0;
                const subtotal = total / 1.16;
                const vat = total - subtotal;
                return (
                  <tr key={po.id} className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${rowBg(po)}`}>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{po.poNumber}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{po.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className={isOverdue(po) ? "text-red-600 font-bold" : ""}>
                        {fmtDate(po.expectedDelivery)}
                      </span>
                      {isOverdue(po) && (
                        <span className="ml-1.5 inline-block bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded font-extrabold tracking-wide animate-pulse">
                          OVERDUE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {fmtMoney(subtotal, po.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {fmtMoney(vat, po.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {fmtMoney(total, po.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.PROCUREMENT_PO_DETAIL(po.id))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 active:scale-95 transition-all"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-medium">
                    No purchase orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
