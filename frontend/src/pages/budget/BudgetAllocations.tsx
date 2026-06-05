import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiClient";
import { Plus, Coins, Calendar, Folder, Check, AlertCircle } from "lucide-react";

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
}

interface Allocation {
  id: string;
  department: string;
  totalAllocation: string | number;
  spentAmount: string | number;
  committedAmount: string | number;
  category: { id: string; name: string; code: string };
  period: { id: string; name: string };
}

export function BudgetAllocations() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAllocModal, setShowAllocModal] = useState(false);

  // Form states
  const [periodForm, setPeriodForm] = useState({ name: "", startDate: "", endDate: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "", description: "" });
  const [allocForm, setAllocForm] = useState({ periodId: "", categoryId: "", department: "", amount: "" });

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      loadAllocations();
    }
  }, [selectedPeriodId]);

  async function loadMetadata() {
    try {
      setLoading(true);
      const [pRes, cRes] = await Promise.all([
        apiFetch("/api/budget/periods"),
        apiFetch("/api/budget/categories"),
      ]);

      if (pRes.ok && cRes.ok) {
        const pData = await pRes.json();
        const cData = await cRes.json();
        setPeriods(pData.periods);
        setCategories(cData.categories);

        const active = pData.periods.find((p: Period) => p.status === "ACTIVE");
        if (active) {
          setSelectedPeriodId(active.id);
        } else if (pData.periods.length > 0) {
          setSelectedPeriodId(pData.periods[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading budget meta:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllocations() {
    try {
      const res = await apiFetch(`/api/budget/allocations?periodId=${selectedPeriodId}`);
      if (res.ok) {
        const data = await res.json();
        setAllocations(data.allocations);
      }
    } catch (err) {
      console.error("Error loading allocations:", err);
    }
  }

  // Submit Period
  const handlePeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/budget/periods", {
        method: "POST",
        body: JSON.stringify(periodForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create period");
      }
      setPeriods([data.period, ...periods]);
      setSelectedPeriodId(data.period.id);
      setShowPeriodModal(false);
      setPeriodForm({ name: "", startDate: "", endDate: "" });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Category
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/budget/categories", {
        method: "POST",
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create category");
      }
      setCategories([...categories, data.category]);
      setShowCategoryModal(false);
      setCategoryForm({ name: "", code: "", description: "" });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Allocation
  const handleAllocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/budget/allocations", {
        method: "POST",
        body: JSON.stringify({
          periodId: allocForm.periodId,
          categoryId: allocForm.categoryId,
          department: allocForm.department,
          amount: Number(allocForm.amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to allocate funds");
      }
      setShowAllocModal(false);
      setAllocForm({ periodId: "", categoryId: "", department: "", amount: "" });
      loadAllocations();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Budget Allocations</h1>
          <p className="text-xs text-slate-500 mt-1">
            Allocate funding targets and monitor budget periods and categories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowPeriodModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>New Period</span>
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Folder className="h-4 w-4 text-slate-400" />
            <span>New Category</span>
          </button>
          <button
            onClick={() => {
              setAllocForm({ ...allocForm, periodId: selectedPeriodId });
              setShowAllocModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-755 shadow-md shadow-indigo-600/15 transition animate-pulse-slow"
          >
            <Plus className="h-4 w-4" />
            <span>Allocate Budget</span>
          </button>
        </div>
      </div>

      {/* FILTER & DATA ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFTPANE: Period and Category listings */}
        <div className="space-y-6 lg:col-span-1">
          {/* PERIOD LIST */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Select Period</h2>
            <div className="space-y-1.5">
              {periods.map((p) => {
                const isActive = p.id === selectedPeriodId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriodId(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                      isActive
                        ? "bg-indigo-50 border-indigo-100 text-indigo-800"
                        : "bg-white border-transparent text-slate-650 hover:bg-slate-50"
                    }`}
                  >
                    <span>{p.name}</span>
                    <span
                      className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase ${
                        p.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CATEGORIES LIST */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Budget Categories</h2>
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {categories.map((c) => (
                <div key={c.id} className="text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-800">{c.name}</span>
                    <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-1.5 rounded">{c.code}</span>
                  </div>
                  {c.description && <p className="text-[10px] text-slate-400 mt-1 font-medium">{c.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHTPANE: Allocation list table */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Allocation Table</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Assigned fund thresholds and department consumption metrics.</p>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/70">
                  <th className="p-4 uppercase tracking-wider text-[10px]">Department</th>
                  <th className="p-4 uppercase tracking-wider text-[10px]">Category</th>
                  <th className="p-4 uppercase tracking-wider text-[10px] text-right">Limit (KES)</th>
                  <th className="p-4 uppercase tracking-wider text-[10px] text-right">Committed (KES)</th>
                  <th className="p-4 uppercase tracking-wider text-[10px] text-right">Actual Spent (KES)</th>
                  <th className="p-4 uppercase tracking-wider text-[10px] text-right">Remaining (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                      No budget allocations found for this period.
                    </td>
                  </tr>
                ) : (
                  allocations.map((a) => {
                    const total = Number(a.totalAllocation);
                    const spent = Number(a.spentAmount);
                    const committed = Number(a.committedAmount);
                    const remaining = total - spent - committed;

                    return (
                      <tr key={a.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-4 font-bold text-slate-800">{a.department}</td>
                        <td className="p-4">
                          <span className="font-bold text-slate-700">{a.category.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">{a.category.code}</span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900">
                          {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-medium text-amber-600">
                          {committed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-medium text-rose-600">
                          {spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-4 text-right font-black ${remaining > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PERIOD MODAL */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Add Budget Period</h3>
              <button onClick={() => setShowPeriodModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handlePeriodSubmit} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1">
                <label>Period Name (e.g. FY 2026 Q3)</label>
                <input
                  type="text"
                  required
                  placeholder="FY 2026 Q3"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label>Start Date</label>
                  <input
                    type="date"
                    required
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label>End Date</label>
                  <input
                    type="date"
                    required
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white p-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                {submitting ? "Submitting..." : "Save Period"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Add Budget Category</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCategorySubmit} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1">
                <label>Category Code (e.g. EXP-TRAV)</label>
                <input
                  type="text"
                  required
                  placeholder="EXP-TRAV"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label>Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="Travel & Lodging"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label>Description</label>
                <textarea
                  placeholder="Description of budget items in this category"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500 h-20"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white p-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                {submitting ? "Submitting..." : "Save Category"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ALLOCATION MODAL */}
      {showAllocModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Allocate Budget Limit</h3>
              <button onClick={() => setShowAllocModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAllocSubmit} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1">
                <label>Select Period</label>
                <select
                  required
                  value={allocForm.periodId}
                  onChange={(e) => setAllocForm({ ...allocForm, periodId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Period --</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label>Select Category</label>
                <select
                  required
                  value={allocForm.categoryId}
                  onChange={(e) => setAllocForm({ ...allocForm, categoryId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label>Department</label>
                <select
                  required
                  value={allocForm.department}
                  onChange={(e) => setAllocForm({ ...allocForm, department: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Department --</option>
                  <option value="Administration">Administration</option>
                  <option value="Sales">Sales</option>
                  <option value="Procurement">Procurement</option>
                  <option value="Production">Production</option>
                  <option value="Milling">Milling</option>
                  <option value="Logistics">Logistics</option>
                </select>
              </div>

              <div className="space-y-1">
                <label>Allocation Limit (KES)</label>
                <input
                  type="number"
                  required
                  placeholder="50000"
                  value={allocForm.amount}
                  onChange={(e) => setAllocForm({ ...allocForm, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white p-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                {submitting ? "Allocating..." : "Save Allocation Limit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
