import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { Invoice } from "../../modules/sales/types/sales";

const fmtKes = (n: number) => `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    void (async () => {
      try {
        const data = await salesApi.invoices.get(invoiceId);
        setInvoice(data.invoice);
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  if (loading || !invoice) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const paid = (invoice.payments ?? []).reduce((s, p) => s + p.amountPaid, 0);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(ROUTES.SALES_INVOICES)}
        className="flex items-center gap-2 text-xs font-bold text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Invoices
      </button>
      <div className="bg-white border rounded-2xl p-6">
        <div className="flex justify-between">
          <h1 className="text-xl font-black">{invoice.invoiceNumber}</h1>
          <StatusBadge status={invoice.status} />
        </div>
        <p className="text-sm text-slate-500 mt-1">{invoice.customer?.name}</p>
        <div className="mt-6 grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
            <p className="font-black">{fmtKes(invoice.total)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Amount due</p>
            <p className="font-black">{fmtKes(invoice.amountDue)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Paid</p>
            <p className="font-black">{fmtKes(paid)}</p>
          </div>
        </div>
        {invoice.salesOrderId && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.SALES_ORDER_DETAIL(invoice.salesOrderId!))}
            className="mt-4 text-xs font-bold text-indigo-600"
          >
            View sales order
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            navigate(
              `${ROUTES.SALES_PAYMENTS}?invoiceId=${invoice.id}&customerId=${invoice.customerId}`
            )
          }
          className="mt-6 inline-block bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
        >
          Record payment
        </button>
      </div>
    </div>
  );
}
