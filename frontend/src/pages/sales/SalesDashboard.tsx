import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Users,
  ShoppingCart,
  Truck,
  FileText,
  Wallet,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { SalesDashboard } from "../../modules/sales/types/sales";

const fmtKes = (n: number) =>
  `KES ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function SalesDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await salesApi.dashboard.get();
        setData(res.dashboard);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "No data"}
      </div>
    );
  }

  const { kpis } = data;

  const kpiCards = [
    { label: "Customers", value: kpis.customerCount, sub: `${kpis.activeCustomers} active`, icon: Users, to: ROUTES.SALES_CUSTOMERS },
    { label: "Sales orders", value: kpis.orderCount, sub: `${kpis.pendingDispatchOrders} awaiting dispatch`, icon: ShoppingCart, to: ROUTES.SALES_ORDERS },
    { label: "Open invoices", value: kpis.openInvoices, sub: `${kpis.overdueInvoices} overdue`, icon: FileText, to: ROUTES.SALES_INVOICES },
    { label: "Dispatches", value: kpis.pendingDispatches + kpis.inTransitDispatches, sub: `${kpis.deliveredDispatches} delivered`, icon: Truck, to: ROUTES.SALES_DISPATCHES },
    { label: "Payments received", value: fmtKes(kpis.totalPaymentsKes), sub: "All time", icon: Wallet, to: ROUTES.SALES_PAYMENTS },
    { label: "Credit exposure", value: fmtKes(kpis.creditExposureKes), sub: "Outstanding balances", icon: AlertTriangle, to: ROUTES.SALES_CUSTOMERS },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Sales Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Orders, customer credit, dispatch pipeline, and collections
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => navigate(card.to)}
              className="text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">{card.label}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{card.value}</p>
              <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-sm font-black text-slate-900">Recent orders</h2>
            <button
              type="button"
              onClick={() => navigate(ROUTES.SALES_ORDERS)}
              className="text-[10px] font-bold text-indigo-600"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {data.recentOrders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => navigate(ROUTES.SALES_ORDER_DETAIL(o.id))}
                className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{o.orderNumber}</p>
                  <p className="text-[10px] text-slate-500">{o.customerName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={o.dispatchStatus} />
                  <span className="text-xs font-bold">{fmtKes(o.totalAmount)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-sm font-black text-slate-900">Recent invoices</h2>
            <button
              type="button"
              onClick={() => navigate(ROUTES.SALES_INVOICES)}
              className="text-[10px] font-bold text-indigo-600"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {data.recentInvoices.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => navigate(ROUTES.SALES_INVOICE_DETAIL(inv.id))}
                className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{inv.invoiceNumber}</p>
                  <p className="text-[10px] text-slate-500">{inv.customerName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={inv.status} />
                  <span className="text-xs font-bold">{fmtKes(inv.amountDue)} due</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
