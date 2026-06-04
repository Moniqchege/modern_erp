import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, FileText, Truck, XCircle } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { SalesOrder } from "../../modules/sales/types/sales";

const fmtKes = (n: number) => `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function SalesOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!orderId) return;
    const data = await salesApi.orders.get(orderId);
    setOrder(data.order);
  };

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await load();
      setMessage(ok);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(ROUTES.SALES_ORDERS)}
        className="flex items-center gap-2 text-xs font-bold text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Orders
      </button>

      {message && (
        <p className="text-sm bg-indigo-50 text-indigo-800 px-4 py-2 rounded-lg">{message}</p>
      )}

      <div className="bg-white border rounded-2xl p-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-xl font-black">{order.orderNumber}</h1>
            <p className="text-sm text-slate-500">{order.customer?.name}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatusBadge status={order.orderStatus} />
            <StatusBadge status={order.dispatchStatus} />
            <StatusBadge status={order.paymentStatus} />
          </div>
        </div>
        <p className="text-2xl font-black mt-4">{fmtKes(order.totalAmount)}</p>
        <p className="text-xs text-slate-500">
          Subtotal {fmtKes(order.subtotal)} + VAT {fmtKes(order.taxAmount)}
        </p>

        <table className="w-full mt-6 text-xs">
          <thead className="text-slate-400 font-bold uppercase text-[10px]">
            <tr>
              <th className="text-left py-2">SKU</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Unit</th>
              <th className="text-right py-2">Line</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((line) => (
              <tr key={line.id} className="border-t border-slate-100">
                <td className="py-2">{line.productSku}</td>
                <td className="text-right py-2">{line.quantity}</td>
                <td className="text-right py-2">{fmtKes(line.unitPrice)}</td>
                <td className="text-right py-2 font-bold">{fmtKes(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap gap-2 mt-6">
          {!order.invoice && order.orderStatus !== "CANCELLED" && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(
                  async () => {
                    const inv = await salesApi.invoices.generate({
                      salesOrderId: order.id,
                    });
                    navigate(ROUTES.SALES_INVOICE_DETAIL(inv.invoice.id));
                  },
                  "Invoice generated"
                )
              }
              className="inline-flex items-center gap-1.5 bg-sky-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              <FileText className="h-4 w-4" /> Generate invoice
            </button>
          )}
          {order.invoice && (
            <button
              type="button"
              onClick={() => navigate(ROUTES.SALES_INVOICE_DETAIL(order.invoice!.id))}
              className="text-xs font-bold text-sky-700 underline"
            >
              View invoice {order.invoice.invoiceNumber}
            </button>
          )}
          {order.dispatchStatus !== "DELIVERED" && order.orderStatus !== "CANCELLED" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  act(
                    () =>
                      salesApi.orders.update(order.id, { dispatchStatus: "LOADING" }),
                    "Marked loading"
                  )
                }
                className="text-xs font-bold border px-3 py-2 rounded-xl"
              >
                Mark loading
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  navigate(
                    `${ROUTES.SALES_DISPATCH_NEW}?customerId=${order.customerId}&salesOrderId=${order.id}`
                  )
                }
                className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                <Truck className="h-4 w-4" /> Create dispatch
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  act(
                    () => salesApi.orders.update(order.id, { orderStatus: "FULFILLED" }),
                    "Order fulfilled"
                  )
                }
                className="text-xs font-bold border px-3 py-2 rounded-xl"
              >
                Mark fulfilled
              </button>
            </>
          )}
          {order.orderStatus !== "CANCELLED" && !order.invoice && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(() => salesApi.orders.cancel(order.id), "Order cancelled")
              }
              className="inline-flex items-center gap-1.5 text-red-600 text-xs font-bold px-3 py-2"
            >
              <XCircle className="h-4 w-4" /> Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
