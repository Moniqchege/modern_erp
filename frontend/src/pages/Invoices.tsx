import React, { useState, useEffect } from "react";
import { FileText, Search, Plus, Loader2, Info, Check, AlertCircle, Calendar } from "lucide-react";
import { Customer } from "./Customers";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  status: "DRAFT" | "ISSUED" | "PAID" | "VOID";
  customerId: string;
  customer?: { name: string };
  createdById: string;
  createdBy?: { name: string };
  issuedAt: string | null;
  createdAt: string;
}

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "offline">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [subtotal, setSubtotal] = useState(0.0);
  const [tax, setTax] = useState(0.0);
  const [status, setStatus] = useState<"DRAFT" | "ISSUED" | "PAID" | "VOID">("DRAFT");

  const fetchData = async () => {
    setLoading(true);
    try {
      const custResp = await fetch("/api/customers");
      if (custResp.ok) {
        const custData = await custResp.json();
        if (custData && Array.isArray(custData.customers)) {
          setCustomers(custData.customers);
        }
      }
    } catch (e) {}

    try {
      const invResp = await fetch("/api/invoices");
      if (invResp.ok) {
        const invData = await invResp.json();
        if (invData && Array.isArray(invData.invoices)) {
          setInvoices(invData.invoices);
          setApiStatus("connected");
        }
      } else {
        setApiStatus("offline");
      }
    } catch (e) {
      setApiStatus("offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || !customerId || subtotal <= 0) {
      setErrorText("Invoice Number, Customer, and Subtotal are required fields.");
      return;
    }

    const payload = {
      invoiceNumber,
      customerId,
      subtotal,
      tax,
      status,
      createdById: "admin_1",
    };

    setErrorText(null);
    const selectedCustomer = customers.find((c) => c.id === customerId) || { name: "Acme Corporation" };

    if (apiStatus === "connected") {
      try {
        const response = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.invoice) {
            setInvoices((prev) => [data.invoice, ...prev]);
            closeModal();
          }
        } else {
          const err = await response.json();
          setErrorText(err.message || "Failed to create invoice.");
        }
      } catch (e) {
        setErrorText("Network request failed.");
      }
    } else {
      const total = subtotal + tax;
      const mockNew: Invoice = {
        id: `local_${Date.now()}`,
        invoiceNumber,
        subtotal,
        tax,
        total,
        status,
        customerId,
        customer: { name: selectedCustomer.name },
        createdById: "admin_1",
        createdBy: { name: "System Admin" },
        issuedAt: status !== "DRAFT" ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
      };
      setInvoices((prev) => [mockNew, ...prev]);
      closeModal();
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setInvoiceNumber("");
    setCustomerId("");
    setSubtotal(0.0);
    setTax(0.0);
    setStatus("DRAFT");
    setErrorText(null);
  };

  const getStatusBadge = (invoiceStatus: string) => {
    switch (invoiceStatus) {
      case "PAID":
        return (
          <span className="inline-block text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-lg">
            Paid
          </span>
        );
      case "ISSUED":
        return (
          <span className="inline-block text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/50 px-2.5 py-0.5 rounded-lg">
            Issued
          </span>
        );
      case "VOID":
        return (
          <span className="inline-block text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200/50 px-2.5 py-0.5 rounded-lg">
            Void
          </span>
        );
      default:
        return (
          <span className="inline-block text-[9px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-lg">
            Draft
          </span>
        );
    }
  };

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.customer && inv.customer.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Invoice Ledger</h1>
          <p className="text-xs text-slate-550 mt-1 font-medium">Issue billing statements and track accounts collections.</p>
        </div>

        <div className="flex items-center gap-3">
          {apiStatus === "connected" ? (
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm">
              <Check className="h-3.5 w-3.5" /> Database Live
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-amber-50 text-amber-750 border border-amber-200/60 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm">
              <Info className="h-3.5 w-3.5" /> Sandbox Mode
            </span>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Issue Invoice
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div className="relative max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-indigo-655" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-55 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-all text-slate-800"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-extrabold tracking-widest uppercase">
                <th className="px-6 py-4.5">Invoice #</th>
                <th className="px-6 py-4.5">Customer</th>
                <th className="px-6 py-4.5 text-right">Subtotal</th>
                <th className="px-6 py-4.5 text-right">Tax</th>
                <th className="px-6 py-4.5 text-right">Total</th>
                <th className="px-6 py-4.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-indigo-650 font-bold select-all">
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {inv.customer?.name || "Acme Corporation"}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium">
                    ${inv.subtotal.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-slate-450">
                    ${inv.tax.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-extrabold text-slate-900">
                    ${inv.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(inv.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-655 flex items-center justify-center">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Issue Client Invoice</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Create a new commercial statement transaction.</p>
              </div>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase">Invoice Number</label>
                  <input
                    type="text"
                    required
                    placeholder="INV-2026-002"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ISSUED">Issued</option>
                    <option value="PAID">Paid</option>
                    <option value="VOID">Void</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-455 uppercase">Customer</label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800"
                >
                  <option value="">Select a customer...</option>
                  <option value="cust_1">Acme Corporation</option>
                  <option value="cust_2">Starlight Industries</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase">Subtotal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={subtotal}
                    onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0.0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase">Tax ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(parseFloat(e.target.value) || 0.0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-655 px-4.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 hover:bg-indigo-700 text-white px-4.5 py-2 rounded-lg text-xs font-bold shadow-md shadow-indigo-600/10 active:scale-95 transition-all"
                >
                  Post Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
