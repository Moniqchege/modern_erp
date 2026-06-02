import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Plus,
  Loader2,
  Info,
  Check,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  ShoppingCart,
  Filter,
  Package,
} from "lucide-react";

export type CustomerType =
  | "DISTRIBUTOR"
  | "WHOLESALER"
  | "RETAILER"
  | "WALK_IN";

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: CustomerType;
  creditLimit: number;
  currentBalance: number;
  creditDays: number;
  taxPin: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
}

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  DISTRIBUTOR: "Distributor",
  WHOLESALER: "Wholesaler",
  RETAILER: "Retailer",
  WALK_IN: "Walk-in",
};

const TYPE_BADGE: Record<CustomerType, string> = {
  DISTRIBUTOR: "bg-violet-50 text-violet-700 border-violet-200",
  WHOLESALER: "bg-sky-50 text-sky-700 border-sky-200",
  RETAILER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WALK_IN: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatKes(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CustomerType | "">("");
  const [creditFilter, setCreditFilter] = useState<
    "" | "over_limit" | "has_balance" | "clear"
  >("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "offline">(
    "idle"
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<CustomerType>("RETAILER");
  const [creditLimit, setCreditLimit] = useState("");
  const [creditDays, setCreditDays] = useState("30");
  const [taxPin, setTaxPin] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (creditFilter) params.set("creditStatus", creditFilter);
      const qs = params.toString();
      const response = await fetch(`/api/customers${qs ? `?${qs}` : ""}`);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.customers)) {
          setCustomers(data.customers);
          setApiStatus("connected");
        }
      } else {
        setApiStatus("offline");
      }
    } catch {
      setApiStatus("offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCustomers();
  }, [typeFilter, creditFilter]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setErrorText("Customer name is required.");
      return;
    }

    const payload = {
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      type,
      creditLimit: type === "WALK_IN" ? 0 : Number(creditLimit) || 0,
      creditDays: type === "WALK_IN" ? 0 : Number(creditDays) || 30,
      taxPin: taxPin || null,
    };

    setErrorText(null);
    setSuccessText(null);

    if (apiStatus === "connected") {
      try {
        const response = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.customer) {
            setCustomers((prev) => [data.customer, ...prev]);
            setSuccessText("Customer created.");
            closeModal();
          }
        } else {
          const err = await response.json();
          setErrorText(err.message || "Failed to create customer.");
        }
      } catch {
        setErrorText("Network request failed.");
      }
    } else {
      const mockNew: Customer = {
        id: `local_${Date.now()}`,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        type,
        creditLimit: payload.creditLimit,
        currentBalance: 0,
        creditDays: payload.creditDays,
        taxPin: taxPin || null,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCustomers((prev) => [mockNew, ...prev]);
      closeModal();
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setType("RETAILER");
    setCreditLimit("");
    setCreditDays("30");
    setTaxPin("");
    setErrorText(null);
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.taxPin && c.taxPin.toLowerCase().includes(search.toLowerCase()))
    );
  }, [customers, search]);

  const stats = useMemo(() => {
    const distributors = customers.filter((c) => c.type === "DISTRIBUTOR").length;
    const overLimit = customers.filter(
      (c) => c.currentBalance > c.creditLimit && c.creditLimit > 0
    ).length;
    return { distributors, overLimit, total: customers.length };
  }, [customers]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Customer & Sales
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Distributors, wholesalers, retailers & walk-ins — credit, VAT orders & dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase">Accounts</p>
          <p className="text-lg font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase">Distributors</p>
          <p className="text-lg font-black text-violet-700">{stats.distributors}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase">Over credit</p>
          <p className="text-lg font-black text-rose-600">{stats.overLimit}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <Package className="h-3 w-3" /> SKUs
          </p>
          <p className="text-[10px] font-medium text-slate-600 mt-1">
            FLR-PREM-2KG · FLR-BALE-24KG
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-indigo-655" />
            <input
              type="text"
              placeholder="Search name, email, KRA PIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-all text-slate-800"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as CustomerType | "")}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
              >
                <option value="">All types</option>
                {Object.entries(CUSTOMER_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={creditFilter}
              onChange={(e) =>
                setCreditFilter(
                  e.target.value as "" | "over_limit" | "has_balance" | "clear"
                )
              }
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700"
            >
              <option value="">All credit</option>
              <option value="clear">Clear balance</option>
              <option value="has_balance">Has balance</option>
              <option value="over_limit">Over limit</option>
            </select>
          </div>
        </div>
        {successText && (
          <p className="text-[10px] font-bold text-emerald-600">{successText}</p>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-8 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredCustomers.map((cust) => {
          const creditUsed =
            cust.creditLimit > 0
              ? Math.min(100, (cust.currentBalance / cust.creditLimit) * 100)
              : 0;
          const overLimit =
            cust.creditLimit > 0 && cust.currentBalance > cust.creditLimit;

          return (
            <div
              key={cust.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                    {cust.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-800 truncate">
                      {cust.name}
                    </h3>
                    <span
                      className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded border ${TYPE_BADGE[cust.type] ?? TYPE_BADGE.RETAILER}`}
                    >
                      {CUSTOMER_TYPE_LABELS[cust.type] ?? cust.type}
                    </span>
                  </div>
                </div>
                {overLimit && (
                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded shrink-0">
                    Over limit
                  </span>
                )}
              </div>

              {cust.type !== "WALK_IN" && cust.creditLimit > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Credit
                    </span>
                    <span>
                      {formatKes(cust.currentBalance)} / {formatKes(cust.creditLimit)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${overLimit ? "bg-rose-500" : "bg-indigo-500"}`}
                      style={{ width: `${creditUsed}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-400">
                    {cust.creditDays} days net · VAT invoice on dispatch
                  </p>
                </div>
              )}

              <div className="space-y-2 border-t border-slate-100 pt-4 text-[10px] text-slate-655 font-medium">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{cust.email || "No email"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{cust.phone || "No phone"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="leading-normal">{cust.address || "No address"}</span>
                </div>
                {cust.taxPin && (
                  <p className="text-[9px] text-slate-500 font-mono">PIN: {cust.taxPin}</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  title="Create sales order via API POST /api/sales-orders"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold py-2 rounded-lg transition-colors"
                  onClick={() => {
                    setSuccessText(
                      `Use POST /api/sales-orders with customerId "${cust.id}" and line items (e.g. FLR-PREM-2KG).`
                    );
                  }}
                >
                  <ShoppingCart className="h-3.5 w-3.5" /> New order
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-650 flex items-center justify-center">
                <Users className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Customer</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                  Maize flour buyer profile with credit terms.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-450 uppercase">
                  Company / Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bakeries Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-455 uppercase">
                  Customer type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CustomerType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                >
                  {Object.entries(CUSTOMER_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {type !== "WALK_IN" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-slate-455 uppercase">
                      Credit limit (KES)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold text-slate-455 uppercase">
                      Credit days
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={creditDays}
                      onChange={(e) => setCreditDays(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-455 uppercase">
                  KRA Tax PIN
                </label>
                <input
                  type="text"
                  placeholder="P051234567X"
                  value={taxPin}
                  onChange={(e) => setTaxPin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase">Email</label>
                  <input
                    type="email"
                    placeholder="billing@example.co.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase">Phone</label>
                  <input
                    type="text"
                    placeholder="+254..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-455 uppercase">Address</label>
                <textarea
                  placeholder="Delivery / billing address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs resize-none"
                />
              </div>

              {errorText && (
                <p className="text-[10px] font-bold text-rose-600">{errorText}</p>
              )}

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-655 px-4.5 py-2 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 hover:bg-indigo-700 text-white px-4.5 py-2 rounded-lg text-xs font-bold shadow-md"
                >
                  Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
