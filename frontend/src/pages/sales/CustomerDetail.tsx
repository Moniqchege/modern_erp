import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { Customer, SalesOrder } from "../../modules/sales/types/sales";

const fmtKes = (n: number) => `KES ${n.toLocaleString()}`;

export function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;
    void (async () => {
      try {
        const [c, o] = await Promise.all([
          salesApi.customers.get(customerId),
          salesApi.orders.list({ customerId }),
        ]);
        setCustomer(c.customer);
        setOrders(o.orders ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!customer) {
    return <p className="text-sm text-red-600">Customer not found</p>;
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(ROUTES.SALES_CUSTOMERS)}
        className="flex items-center gap-2 text-xs font-bold text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-xl font-black">{customer.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{customer.email ?? "No email"}</p>
          </div>
          <StatusBadge status={customer.status} />
        </div>
        <div className="mt-4 grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Credit limit</p>
            <p className="font-bold">{fmtKes(customer.creditLimit)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Balance</p>
            <p className="font-bold">{fmtKes(customer.currentBalance)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Tax PIN</p>
            <p className="font-mono text-xs">{customer.taxPin ?? "—"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            navigate(`${ROUTES.SALES_ORDER_NEW}?customerId=${customer.id}`)
          }
          className="mt-6 inline-flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
        >
          <ShoppingCart className="h-4 w-4" /> New order
        </button>
      </div>

      <section>
        <h2 className="text-sm font-black mb-3">Order history</h2>
        <div className="bg-white border border-slate-200 rounded-2xl divide-y">
          {orders.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No orders yet</p>
          ) : (
            orders.map((o) => (
              <Link
                key={o.id}
                to={ROUTES.SALES_ORDER_DETAIL(o.id)}
                className="flex justify-between items-center px-5 py-3 hover:bg-slate-50"
              >
                <span className="text-xs font-bold">{o.orderNumber}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.orderStatus} />
                  <span className="text-xs font-bold">{fmtKes(o.totalAmount)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
