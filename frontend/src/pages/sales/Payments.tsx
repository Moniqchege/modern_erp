import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { Customer, CustomerPayment, Invoice } from "../../modules/sales/types/sales";

const fmtKes = (n: number) => `KES ${n.toLocaleString()}`;

export function Payments() {
  const [searchParams] = useSearchParams();
  const prefillInvoiceId = searchParams.get("invoiceId") ?? "";
  const prefillCustomerId = searchParams.get("customerId") ?? "";

  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(!!prefillInvoiceId);
  const [customerId, setCustomerId] = useState(prefillCustomerId);
  const [invoiceId, setInvoiceId] = useState(prefillInvoiceId);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("MPESA");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c, i] = await Promise.all([
        salesApi.payments.list(),
        salesApi.customers.list(),
        salesApi.invoices.list(),
      ]);
      setPayments(p.payments ?? []);
      setCustomers(c.customers ?? []);
      setInvoices(i.invoices ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openInvoices = invoices.filter(
    (inv) =>
      (inv.status === "ISSUED" || inv.status === "PARTIAL") &&
      (!customerId || inv.customerId === customerId)
  );

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !invoiceId || amountPaid <= 0) {
      setError("Customer, invoice and amount required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await salesApi.payments.record({
        customerId,
        invoiceId,
        amountPaid,
        paymentMethod,
        transactionReference: reference || null,
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h1 className="text-xl font-black">Payments</h1>
          <p className="text-xs text-slate-500">Receipts against customer invoices</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
        >
          <Plus className="h-4 w-4" /> Record payment
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="bg-white border rounded-2xl divide-y">
          {payments.map((p) => (
            <div key={p.id} className="px-5 py-4 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold">{p.invoice?.invoiceNumber}</p>
                <p className="text-[10px] text-slate-500">{p.customer?.name}</p>
                <p className="text-[10px] text-slate-400">{p.paymentMethod} · {p.paidAt.slice(0, 10)}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-sm">{fmtKes(p.amountPaid)}</p>
                {p.invoice && <StatusBadge status={p.invoice.status} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleRecord}
            className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3"
          >
            <h3 className="font-bold">Record payment</h3>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <select
              required
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setInvoiceId("");
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              required
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Invoice</option>
              {openInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {fmtKes(inv.amountDue)} due
                </option>
              ))}
            </select>
            <input
              type="number"
              required
              min={0.01}
              value={amountPaid || ""}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              placeholder="Amount (KES)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="MPESA">M-Pesa</option>
              <option value="BANK">Bank</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
            </select>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction reference"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 border py-2 rounded-xl text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
