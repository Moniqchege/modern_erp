import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiClient";
import {
  TrendingUp,
  Briefcase,
  Compass,
  FileSpreadsheet,
  Plus,
  BookOpen,
  ArrowRight,
  TrendingDown,
  Activity,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../app/router/routes";

interface JournalEntry {
  id: string;
  entryNumber: string;
  reference?: string;
  description: string;
  date: string;
  status: string;
  createdAt: string;
  lines: {
    debit: string | number;
    credit: string | number;
    account: { name: string; code: string };
  }[];
}

export function FinanceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recentJournals, setRecentJournals] = useState<JournalEntry[]>([]);
  const [balances, setBalances] = useState({
    assets: 0,
    liabilities: 0,
    equity: 0,
    revenue: 0,
    expense: 0,
    netIncome: 0,
    bankBalance: 0,
  });

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [bsRes, plRes, tbRes, jeRes] = await Promise.all([
          apiFetch("/api/finance/reports/balance-sheet"),
          apiFetch("/api/finance/reports/income-statement"),
          apiFetch("/api/finance/reports/trial-balance"),
          apiFetch("/api/finance/journals"),
        ]);

        if (bsRes.ok && plRes.ok && tbRes.ok && jeRes.ok) {
          const bs = await bsRes.json();
          const pl = await plRes.json();
          const tb = await tbRes.json();
          const je = await jeRes.json();

          const bankAccount = tb.records.find((r: any) => r.code === "1010");

          setBalances({
            assets: bs.totals.assets,
            liabilities: bs.totals.liabilities,
            equity: bs.totals.equity,
            revenue: pl.totals.revenue,
            expense: pl.totals.expense,
            netIncome: pl.totals.netIncome,
            bankBalance: bankAccount ? Number(bankAccount.debit) - Number(bankAccount.credit) : 0,
          });

          setRecentJournals(je.journals.slice(0, 5));
        }
      } catch (err) {
        console.error("Error loading finance dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return <div className="p-8 text-xs font-bold text-slate-500 font-sans">Loading Dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial Overview</h1>
          <p className="text-xs text-slate-500 mt-1">
            General ledger bookkeeping, real-time balance sheets, and automated expense reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(ROUTES.FINANCE_JOURNALS)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/15 transition animate-pulse-slow"
          >
            <Plus className="h-4 w-4" />
            <span>Create Journal Entry</span>
          </button>
        </div>
      </div>

      {/* STATS PANEL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* TOTAL ASSETS */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm group hover:border-blue-300 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Assets</span>
            <span className="text-2xl font-black text-slate-900 mt-2">
              KES {balances.assets.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-700 mt-4">
              <TrendingUp className="h-3 w-3" />
              <span>General ledger cash & stock value</span>
            </div>
          </div>
        </div>

        {/* BANK BALANCE */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm group hover:border-cyan-300 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operating Bank Cash</span>
            <span className="text-2xl font-black text-slate-900 mt-2">
              KES {balances.bankBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-700 mt-4">
              <Activity className="h-3 w-3" />
              <span>Main operating cash (Account 1010)</span>
            </div>
          </div>
        </div>

        {/* TOTAL LIABILITIES */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm group hover:border-rose-300 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Liabilities</span>
            <span className="text-2xl font-black text-slate-900 mt-2">
              KES {balances.liabilities.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 mt-4">
              <TrendingDown className="h-3 w-3" />
              <span>Accounts payable + clearing items</span>
            </div>
          </div>
        </div>

        {/* NET PROFIT */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl relative overflow-hidden shadow-sm group hover:border-emerald-300 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Income (P&L)</span>
            <span className={`text-2xl font-black mt-2 ${balances.netIncome >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              KES {balances.netIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 mt-4">
              <TrendingUp className="h-3 w-3" />
              <span>Current fiscal quarter net profit</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK SHORTCUTS & RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QUICK SHORTCUTS */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Finance Operations</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Quick navigations for accounts, logs, and report statements.</p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-xs font-bold text-slate-700">
            <button
              onClick={() => navigate(ROUTES.FINANCE_ACCOUNTS)}
              className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-xl transition text-left"
            >
              <div className="flex items-center gap-3">
                <Compass className="h-4 w-4 text-blue-600" />
                <span>Chart of Accounts</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => navigate(ROUTES.FINANCE_JOURNALS)}
              className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-xl transition text-left"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <span>General Ledger Entries</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => navigate(ROUTES.FINANCE_REPORTS)}
              className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-xl transition text-left"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                <span>Profit & Loss statement</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* RECENT JOURNAL ENTRIES */}
        <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Recent Journal Postings</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Most recent double-entry bookings recorded in the ledger.</p>
              </div>
              <button
                onClick={() => navigate(ROUTES.FINANCE_JOURNALS)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>View Ledger log</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="space-y-3">
              {recentJournals.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  No transaction journals recorded.
                </div>
              ) : (
                recentJournals.map((j) => {
                  // Sum debits for total amount
                  const total = j.lines.reduce((sum, l) => sum + Number(l.debit), 0);

                  return (
                    <div
                      key={j.id}
                      onClick={() => navigate(ROUTES.FINANCE_JOURNALS)}
                      className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition cursor-pointer flex justify-between items-center gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-700">{j.entryNumber}</span>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                              j.status === "POSTED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                                : "bg-amber-50 text-amber-700 border-amber-200/50"
                            }`}
                          >
                            {j.status}
                          </span>
                        </div>
                        <p className="font-bold text-slate-800 mt-1 truncate">{j.description}</p>
                        <p className="text-[9px] text-slate-450 mt-0.5 font-semibold">
                          Posted on {new Date(j.date).toLocaleDateString()}
                          {j.reference ? ` • Ref: ${j.reference}` : ""}
                        </p>
                      </div>

                      <span className="font-black text-slate-900 shrink-0">
                        KES {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
