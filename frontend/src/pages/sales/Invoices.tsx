import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { Invoice } from "../../modules/sales/types/sales";

const fmtKes = (n: number) => `KES ${n.toLocaleString()}`;

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await salesApi.invoices.list({
          status: statusFilter || undefined,
        });
        setInvoices(data.invoices ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black">Invoices</h1>
        <p className="text-xs text-slate-500">Generated from confirmed sales orders (16% VAT)</p>
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="border rounded-lg text-xs px-3 py-2"
      >
        <option value="">All statuses</option>
        <option value="ISSUED">Issued</option>
        <option value="PARTIAL">Partial</option>
        <option value="PAID">Paid</option>
        <option value="OVERDUE">Overdue</option>
      </select>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="bg-white border rounded-2xl divide-y">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              to={ROUTES.SALES_INVOICE_DETAIL(inv.id)}
              className="flex justify-between items-center px-5 py-4 hover:bg-slate-50"
            >
              <div>
                <p className="text-xs font-bold">{inv.invoiceNumber}</p>
                <p className="text-[10px] text-slate-500">{inv.customer?.name}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <StatusBadge status={inv.status} />
                <span className="text-xs font-bold">{fmtKes(inv.amountDue)} due</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
