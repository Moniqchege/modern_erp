import React, { useState, useEffect } from "react";
import { Users, Search, Plus, Loader2, Info, Check, AlertCircle, Mail, Phone, MapPin } from "lucide-react";

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "offline">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customers");
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.customers)) {
          setCustomers(data.customers);
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
    fetchCustomers();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setErrorText("Customer Name is required.");
      return;
    }

    const payload = {
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
    };

    setErrorText(null);

    if (apiStatus === "connected") {
      try {
        const response = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.customer) {
            setCustomers((prev) => [data.customer, ...prev]);
            closeModal();
          }
        } else {
          const err = await response.json();
          setErrorText(err.message || "Failed to create customer.");
        }
      } catch (e) {
        setErrorText("Network request failed.");
      }
    } else {
      const mockNew: Customer = {
        id: `local_${Date.now()}`,
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
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
    setErrorText(null);
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Manage corporate accounts and wholesale buyers.</p>
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
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div className="relative max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-indigo-655" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-all text-slate-800"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredCustomers.map((cust) => (
          <div key={cust.id} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                {cust.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-800 truncate">{cust.name}</h3>
                <span className="text-[9px] text-slate-400 font-mono">ID: {cust.id}</span>
              </div>
            </div>

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
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-650 flex items-center justify-center">
                <Users className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Customer</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Register client profile details.</p>
              </div>
            </div>

            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-450 uppercase">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bakeries Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase">Email</label>
                  <input
                    type="email"
                    placeholder="billing@bakeries.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-455 uppercase">Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-455 uppercase">Address</label>
                <textarea
                  placeholder="Billing address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 resize-none font-medium"
                />
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
