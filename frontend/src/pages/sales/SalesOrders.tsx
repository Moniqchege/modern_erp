import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { SalesOrder } from "../../modules/sales/types/sales";

const fmtKes = (n: number) => `KES ${n.toLocaleString()}`;

export function SalesOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatchFilter, setDispatchFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await salesApi.orders.list({
        dispatchStatus: dispatchFilter || undefined,
      });
      setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dispatchFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black">Sales orders</h1>
          <p className="text-xs text-slate-500">Confirm → dispatch → invoice → payment</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.SALES_ORDER_NEW)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
        >
          <Plus className="h-4 w-4" /> New order
        </button>
      </div>

      <select
        value={dispatchFilter}
        onChange={(e) => setDispatchFilter(e.target.value)}
        className="border border-slate-200 rounded-lg text-xs px-3 py-2"
      >
        <option value="">All dispatch statuses</option>
        <option value="PENDING">Pending</option>
        <option value="LOADING">Loading</option>
        <option value="DISPATCHED">Dispatched</option>
        <option value="DELIVERED">Delivered</option>
      </select>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Dispatch</th>
                <th className="text-right px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={ROUTES.SALES_ORDER_DETAIL(o.id)}
                      className="font-bold text-indigo-600"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{o.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.orderStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.dispatchStatus} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {fmtKes(o.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
