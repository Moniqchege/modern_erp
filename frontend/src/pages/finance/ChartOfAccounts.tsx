import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiClient";
import { Plus, Compass, AlertCircle } from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  balance: string | number;
  description?: string;
  status: string;
}

export function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "ASSET" as Account["type"], description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      const res = await apiFetch("/api/finance/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error("Error loading accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/finance/accounts", {
        method: "POST",
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create account");
      }

      setAccounts([...accounts, data.account].sort((a, b) => a.code.localeCompare(b.code)));
      setShowModal(false);
      setForm({ code: "", name: "", type: "ASSET", description: "" });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Group accounts
  const grouped = accounts.reduce((acc, a) => {
    acc[a.type] = acc[a.type] || [];
    acc[a.type].push(a);
    return acc;
  }, {} as Record<Account["type"], Account[]>);

  const filteredAccounts = accounts.filter((a) => {
    if (activeTab === "ALL") return true;
    return a.type === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Chart of Accounts</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure the General Ledger Chart of Accounts structure and track current balances.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/25 transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Account</span>
        </button>
      </div>

      {/* FILTER BUTTONS */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-2xl shadow-sm flex flex-wrap gap-2">
        {["ALL", "ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((tab) => {
          const count = tab === "ALL" ? accounts.length : (grouped[tab as Account["type"]] || []).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <span>{tab}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${activeTab === tab ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* LIST TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/70">
                <th className="p-4 uppercase tracking-wider text-[10px] w-24">Account Code</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Account Name</th>
                <th className="p-4 uppercase tracking-wider text-[10px] w-32">Type</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Description</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-right w-36">Current Balance (KES)</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-center w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">Loading GL Accounts...</td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">No accounts found.</td>
                </tr>
              ) : (
                filteredAccounts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-4 font-mono font-bold text-slate-900">{a.code}</td>
                    <td className="p-4 font-bold text-slate-800">{a.name}</td>
                    <td className="p-4">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${
                          a.type === "ASSET"
                            ? "bg-blue-50 text-blue-700 border-blue-200/50"
                            : a.type === "LIABILITY"
                            ? "bg-rose-50 text-rose-700 border-rose-200/50"
                            : a.type === "EQUITY"
                            ? "bg-purple-50 text-purple-700 border-purple-200/50"
                            : a.type === "REVENUE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                            : "bg-slate-50 text-slate-700 border-slate-200/50"
                        }`}
                      >
                        {a.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-medium">{a.description || "-"}</td>
                    <td className="p-4 text-right font-black text-slate-900">
                      {Number(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full uppercase ${a.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-250/50" : "bg-slate-50 text-slate-500"}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Register General Ledger Account</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAccountSubmit} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1">
                <label>Account Code (Numerical)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1050"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label>Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Petty Cash / Imprests"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label>Account Type</label>
                <select
                  required
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Account["type"] })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>

              <div className="space-y-1">
                <label>Description</label>
                <textarea
                  placeholder="Scope or purpose of this account ledger..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-blue-500 h-20"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white p-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20"
              >
                {submitting ? "Submitting..." : "Save Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
