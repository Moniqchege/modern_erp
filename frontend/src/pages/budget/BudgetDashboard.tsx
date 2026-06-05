import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiClient";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingDown,
  Percent,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../app/router/routes";

interface BudgetAllocation {
  id: string;
  department: string;
  totalAllocation: string | number;
  spentAmount: string | number;
  committedAmount: string | number;
  category: {
    name: string;
    code: string;
  };
  period: {
    id: string;
    name: string;
  };
}

interface ImprestRequest {
  id: string;
  requestNo: string;
  requester: { name: string };
  amount: string | number;
  purpose: string;
  status: string;
  createdAt: string;
  budget: {
    category: { name: string };
  };
}

interface BudgetPeriod {
  id: string;
  name: string;
  status: string;
}

export function BudgetDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<BudgetPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
  const [imprests, setImprests] = useState<ImprestRequest[]>([]);

  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        // Fetch periods
        const pRes = await apiFetch("/api/budget/periods");
        if (pRes.ok) {
          const pData = await pRes.json();
          setPeriods(pData.periods);
          const active = pData.periods.find((p: BudgetPeriod) => p.status === "ACTIVE");
          if (active) {
            setSelectedPeriodId(active.id);
          } else if (pData.periods.length > 0) {
            setSelectedPeriodId(pData.periods[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading periods:", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) return;

    async function loadPeriodData() {
      try {
        const [aRes, iRes] = await Promise.all([
          apiFetch(`/api/budget/allocations?periodId=${selectedPeriodId}`),
          apiFetch("/api/budget/imprests"),
        ]);

        if (aRes.ok) {
          const aData = await aRes.json();
          setAllocations(aData.allocations);
        }
        if (iRes.ok) {
          const iData = await iRes.json();
          setImprests(iData.imprests.slice(0, 5)); // show top 5 recent
        }
      } catch (err) {
        console.error("Error loading period data:", err);
      }
    }

    loadPeriodData();
  }, [selectedPeriodId]);

  // Compute totals
  const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.totalAllocation), 0);
  const totalSpent = allocations.reduce((sum, a) => sum + Number(a.spentAmount), 0);
  const totalCommitted = allocations.reduce((sum, a) => sum + Number(a.committedAmount), 0);
  const remainingBudget = totalAllocated - totalSpent - totalCommitted;
  const burnRate = totalAllocated > 0 ? ((totalSpent + totalCommitted) / totalAllocated) * 100 : 0;

  if (loading) {
    return <div className="p-8 text-xs font-bold text-slate-500">Loading Dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Budget & Imprest Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time tracking of department spending limits, cash commitments, and petty cash imprests.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-xl shadow-sm">
          <span className="text-xs font-bold text-slate-500 pl-2">Active Period:</span>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.status === "ACTIVE" ? "(Active)" : "(Closed)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* TOTAL BUDGET */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm group hover:border-indigo-300 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Allocated</span>
            <span className="text-2xl font-black text-slate-900 mt-2">KES {totalAllocated.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 mt-4">
              <TrendingUp className="h-3 w-3" />
              <span>Full allocation limit</span>
            </div>
          </div>
        </div>

        {/* TOTAL SPENT */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm group hover:border-rose-300 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Actual Spent</span>
            <span className="text-2xl font-black text-slate-900 mt-2">KES {totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 mt-4">
              <TrendingDown className="h-3 w-3" />
              <span>{burnRate.toFixed(1)}% of budget utilized</span>
            </div>
          </div>
        </div>

        {/* COMMITTED */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm group hover:border-amber-300 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Committed Funds</span>
            <span className="text-2xl font-black text-slate-900 mt-2">KES {totalCommitted.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 mt-4">
              <Clock className="h-3 w-3" />
              <span>Approved imprests outstanding</span>
            </div>
          </div>
        </div>

        {/* REMAINING BUDGET */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm group hover:border-emerald-300 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Remaining Balance</span>
            <span className="text-2xl font-black text-emerald-700 mt-2">KES {remainingBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 mt-4">
              <CheckCircle className="h-3 w-3" />
              <span>{(100 - burnRate).toFixed(1)}% free funds available</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DEPARTMENT SPENDING LIMITS */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Department Spending limits</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Summary of allocations and consumption status.</p>
            </div>
            <button
              onClick={() => navigate(ROUTES.BUDGET_ALLOCATIONS)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1"
            >
              <span>Manage Allocations</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-5">
            {allocations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">
                No budget allocations defined for this period.
              </div>
            ) : (
              allocations.map((a) => {
                const total = Number(a.totalAllocation);
                const spent = Number(a.spentAmount);
                const committed = Number(a.committedAmount);
                const free = total - spent - committed;
                const percentUsed = total > 0 ? ((spent + committed) / total) * 100 : 0;
                
                return (
                  <div key={a.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-800">
                        {a.department} • <span className="text-slate-400 font-medium">{a.category.name}</span>
                      </span>
                      <span className="text-slate-500">
                        KES {(spent + committed).toLocaleString()} / KES {total.toLocaleString()}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.min(100, (spent / total) * 100)}%` }}
                        className="bg-rose-500 h-full"
                        title={`Spent: ${(spent / total * 100).toFixed(1)}%`}
                      />
                      <div
                        style={{ width: `${Math.min(100, (committed / total) * 100)}%` }}
                        className="bg-amber-400 h-full"
                        title={`Committed: ${(committed / total * 100).toFixed(1)}%`}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                      <span>Spent: KES {spent.toLocaleString()}</span>
                      <span>Committed: KES {committed.toLocaleString()}</span>
                      <span className="font-bold text-emerald-600">Remaining: KES {free.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RECENT IMPRESTS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Recent Imprests</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Latest cash claims submissions.</p>
              </div>
              <button
                onClick={() => navigate(ROUTES.BUDGET_IMPRESTS)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="space-y-3">
              {imprests.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  No imprest requests found.
                </div>
              ) : (
                imprests.map((i) => {
                  let badgeColor = "bg-slate-100 text-slate-600";
                  if (i.status === "PENDING_APPROVAL") badgeColor = "bg-amber-50 text-amber-700 border-amber-200/50";
                  if (i.status === "APPROVED") badgeColor = "bg-blue-50 text-blue-700 border-blue-200/50";
                  if (i.status === "DISBURSED") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
                  if (i.status === "SURRENDERED") badgeColor = "bg-purple-50 text-purple-700 border-purple-200/50";
                  if (i.status === "REJECTED") badgeColor = "bg-rose-50 text-rose-700 border-rose-200/50";

                  return (
                    <div
                      key={i.id}
                      onClick={() => navigate(ROUTES.BUDGET_IMPRESTS)}
                      className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition cursor-pointer flex justify-between items-start gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-700">{i.requestNo}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${badgeColor}`}>
                            {i.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 mt-1 truncate">{i.purpose}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                          Claimed by {i.requester.name} • {new Date(i.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <span className="text-xs font-black text-slate-900 text-right shrink-0">
                        KES {Number(i.amount).toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
