import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Loader2, X, Eye } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { Customer, CustomerType } from "../../modules/sales/types/sales";

const TYPE_LABELS: Record<CustomerType, string> = {
  DISTRIBUTOR: "Distributor",
  WHOLESALER: "Wholesaler",
  RETAILER: "Retailer",
  WALK_IN: "Walk-in",
};

const fmtKes = (n: number) =>
  `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

export function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<CustomerType>("RETAILER");
  const [creditLimit, setCreditLimit] = useState(0);
  const [taxPin, setTaxPin] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await salesApi.customers.list();
      setCustomers(data.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.email ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [customers, search]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await salesApi.customers.create({
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        address: address || null,
        type,
        creditLimit: type === "WALK_IN" ? 0 : creditLimit,
        taxPin: taxPin || null,
      } as Partial<Customer>);
      setModalOpen(false);
      setName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setCreditLimit(0);
      setTaxPin("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Customers</h1>
          <p className="text-xs text-slate-500 mt-1">Credit accounts, tax PINs & order history</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
        >
          <Plus className="h-4 w-4" /> Add customer
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const overLimit = c.creditLimit > 0 && c.currentBalance > c.creditLimit;
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900">{c.name}</h3>
                    <p className="text-[10px] text-slate-500">{TYPE_LABELS[c.type]}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                {c.creditLimit > 0 && (
                  <p className={`text-xs font-bold ${overLimit ? "text-red-600" : "text-slate-600"}`}>
                    Balance {fmtKes(c.currentBalance)} / {fmtKes(c.creditLimit)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.SALES_CUSTOMER_DETAIL(c.id))}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-bold py-2 rounded-lg bg-slate-900 text-white"
                >
                  <Eye className="h-3.5 w-3.5" /> View & orders
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">New customer</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company / name"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CustomerType)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              {type !== "WALK_IN" && (
                <input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(Number(e.target.value))}
                  placeholder="Credit limit (KES)"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm"
              >
                {saving ? "Saving…" : "Create customer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
