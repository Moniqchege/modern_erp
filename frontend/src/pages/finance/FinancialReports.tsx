import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiClient";
import { FileSpreadsheet, Printer, Activity, CheckCircle, AlertCircle } from "lucide-react";

interface ReportRecord {
  id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

interface IncomeStatementReport {
  revenues: { id: string; code: string; name: string; amount: number }[];
  expenses: { id: string; code: string; name: string; amount: number }[];
  totals: { revenue: number; expense: number; netIncome: number };
}

interface BalanceSheetReport {
  assets: { id: string; code: string; name: string; amount: number }[];
  liabilities: { id: string; code: string; name: string; amount: number }[];
  equities: { id: string; code: string; name: string; amount: number }[];
  totals: { assets: number; liabilities: number; equity: number; liabilitiesAndEquity: number };
}

export function FinancialReports() {
  const [activeReportTab, setActiveReportTab] = useState<"TB" | "PL" | "BS">("TB");
  const [loading, setLoading] = useState(true);

  // Data states
  const [trialBalance, setTrialBalance] = useState<{ records: ReportRecord[]; totals: { debit: number; credit: number } } | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      setLoading(true);
      const [tbRes, plRes, bsRes] = await Promise.all([
        apiFetch("/api/finance/reports/trial-balance"),
        apiFetch("/api/finance/reports/income-statement"),
        apiFetch("/api/finance/reports/balance-sheet"),
      ]);

      if (tbRes.ok && plRes.ok && bsRes.ok) {
        const tbData = await tbRes.json();
        const plData = await plRes.json();
        const bsData = await bsRes.json();

        setTrialBalance(tbData);
        setIncomeStatement(plData);
        setBalanceSheet(bsData);
      }
    } catch (err) {
      console.error("Error loading financial statements:", err);
    } finally {
      setLoading(false);
    }
  }

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-8 text-xs font-bold text-slate-500 font-sans">Loading Statements...</div>;
  }

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial Statements</h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate and export ledger Trial Balance sheet, Profit & Loss summaries, and Balance Sheets.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-705 hover:bg-slate-50 shadow-sm transition"
        >
          <Printer className="h-4 w-4 text-slate-400" />
          <span>Print Statement</span>
        </button>
      </div>

      {/* TAB SELECTOR */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-2xl shadow-sm flex gap-2 print:hidden">
        <button
          onClick={() => setActiveReportTab("TB")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeReportTab === "TB" ? "bg-blue-650 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Trial Balance
        </button>
        <button
          onClick={() => setActiveReportTab("PL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeReportTab === "PL" ? "bg-blue-650 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Profit & Loss (P&L)
        </button>
        <button
          onClick={() => setActiveReportTab("BS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeReportTab === "BS" ? "bg-blue-650 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Balance Sheet
        </button>
      </div>

      {/* PRINT-ONLY TITLE */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h1 className="text-xl font-black text-slate-900">Uwezo General Ledger Systems</h1>
        <p className="text-sm font-bold text-slate-500 mt-1">
          {activeReportTab === "TB" && "Statement of Trial Balance"}
          {activeReportTab === "PL" && "Profit & Loss (Income) Statement"}
          {activeReportTab === "BS" && "Statement of Financial Position (Balance Sheet)"}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">As of {new Date().toLocaleDateString()}</p>
      </div>

      {/* REPORT CONTENT VIEW */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:border-0 print:shadow-none">
        
        {/* 1. TRIAL BALANCE */}
        {activeReportTab === "TB" && trialBalance && (
          <div className="space-y-4">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 print:p-2">
              <h2 className="text-sm font-bold text-slate-900">Trial Balance</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Double-entry ledger balancing check.</p>
            </div>
            
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/70">
                  <th className="p-4 w-28 uppercase tracking-wider text-[10px] print:p-2">Account Code</th>
                  <th className="p-4 uppercase tracking-wider text-[10px] print:p-2">Account Name</th>
                  <th className="p-4 w-32 uppercase tracking-wider text-[10px] print:p-2">Account Type</th>
                  <th className="p-4 w-44 text-right uppercase tracking-wider text-[10px] print:p-2">Debit Balance (KES)</th>
                  <th className="p-4 w-44 text-right uppercase tracking-wider text-[10px] print:p-2">Credit Balance (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trialBalance.records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-mono font-bold text-slate-900 print:p-2">{r.code}</td>
                    <td className="p-4 font-bold text-slate-800 print:p-2">{r.name}</td>
                    <td className="p-4 font-semibold text-slate-500 print:p-2">{r.type}</td>
                    <td className="p-4 text-right font-semibold text-slate-900 print:p-2">
                      {r.debit > 0 ? r.debit.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                    </td>
                    <td className="p-4 text-right font-semibold text-slate-900 print:p-2">
                      {r.credit > 0 ? r.credit.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                    </td>
                  </tr>
                ))}
                
                {/* TOTALS */}
                <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-350">
                  <td colSpan={3} className="p-4 uppercase tracking-wider text-[10px] print:p-2">Total Balances</td>
                  <td className="p-4 text-right text-sm border-double border-b-4 border-slate-900 print:p-2">
                    KES {trialBalance.totals.debit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right text-sm border-double border-b-4 border-slate-900 print:p-2">
                    KES {trialBalance.totals.credit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Reconciliation Check strip */}
            <div className="p-4 border-t border-slate-100 flex justify-end print:hidden">
              {Math.abs(trialBalance.totals.debit - trialBalance.totals.credit) < 0.02 ? (
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>Trial Balance Reconciled & Balanced</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg text-xs font-bold animate-bounce">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Warning: Trial Balance out of alignment by KES {Math.abs(trialBalance.totals.debit - trialBalance.totals.credit).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. PROFIT & LOSS */}
        {activeReportTab === "PL" && incomeStatement && (
          <div className="p-6 space-y-6 print:p-2">
            <div className="border-b pb-3">
              <h2 className="text-sm font-bold text-slate-900">Profit & Loss Statement</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Calculated net revenues minus operating expense costs.</p>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700 max-w-3xl mx-auto">
              
              {/* REVENUE */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block mb-1">Revenues</span>
                {incomeStatement.revenues.map((r) => (
                  <div key={r.id} className="flex justify-between border-b border-slate-150 pb-1.5 font-bold">
                    <span>{r.code} - {r.name}</span>
                    <span className="text-slate-900">KES {r.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-slate-900 font-extrabold border-t border-slate-350">
                  <span className="uppercase text-[10px]">Total Revenue</span>
                  <span>KES {incomeStatement.totals.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* EXPENSES */}
              <div className="space-y-1.5 pt-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block mb-1">Operating Expenses</span>
                {incomeStatement.expenses.map((e) => (
                  <div key={e.id} className="flex justify-between border-b border-slate-150 pb-1.5">
                    <span>{e.code} - {e.name}</span>
                    <span className="text-slate-900 font-bold">KES {e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-slate-900 font-extrabold border-t border-slate-350">
                  <span className="uppercase text-[10px]">Total Expenses</span>
                  <span>KES {incomeStatement.totals.expense.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* NET INCOME */}
              <div className="pt-6 border-t-2 border-slate-900">
                <div className="flex justify-between text-slate-950 font-black text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="uppercase">Net Operating Income</span>
                  <span className={incomeStatement.totals.netIncome >= 0 ? "text-emerald-700" : "text-rose-700"}>
                    KES {incomeStatement.totals.netIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. BALANCE SHEET */}
        {activeReportTab === "BS" && balanceSheet && (
          <div className="p-6 space-y-6 print:p-2">
            <div className="border-b pb-3">
              <h2 className="text-sm font-bold text-slate-900">Statement of Financial Position</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Reconciliation of Assets vs Liabilities & Equities.</p>
            </div>

            <div className="space-y-6 text-xs font-semibold text-slate-700 max-w-3xl mx-auto">
              
              {/* ASSETS */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block mb-1">Assets</span>
                {balanceSheet.assets.map((a) => (
                  <div key={a.id} className="flex justify-between border-b border-slate-150 pb-1.5 font-bold">
                    <span>{a.code} - {a.name}</span>
                    <span className="text-slate-900">KES {a.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-slate-950 font-extrabold border-t border-slate-350 text-sm">
                  <span className="uppercase text-[10px]">Total Assets</span>
                  <span className="border-b-4 border-double border-slate-900">
                    KES {balanceSheet.totals.assets.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* LIABILITIES */}
              <div className="space-y-1.5 pt-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block mb-1">Liabilities</span>
                {balanceSheet.liabilities.length === 0 ? (
                  <div className="text-slate-400 italic text-[11px] py-1">No liability account balances.</div>
                ) : (
                  balanceSheet.liabilities.map((l) => (
                    <div key={l.id} className="flex justify-between border-b border-slate-150 pb-1.5 font-bold">
                      <span>{l.code} - {l.name}</span>
                      <span className="text-slate-900">KES {l.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between pt-2 text-slate-900 font-extrabold border-t border-slate-350">
                  <span className="uppercase text-[10px]">Total Liabilities</span>
                  <span>KES {balanceSheet.totals.liabilities.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* EQUITY */}
              <div className="space-y-1.5 pt-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block mb-1">Owner Equities</span>
                {balanceSheet.equities.map((e) => (
                  <div key={e.id} className="flex justify-between border-b border-slate-150 pb-1.5">
                    <span>{e.code} - {e.name}</span>
                    <span className="text-slate-900 font-bold">KES {e.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-slate-900 font-extrabold border-t border-slate-350">
                  <span className="uppercase text-[10px]">Total Equity</span>
                  <span>KES {balanceSheet.totals.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* LIABILITIES & EQUITY RECONCILIATION */}
              <div className="pt-6 border-t-2 border-slate-900">
                <div className="flex justify-between text-slate-950 font-black text-sm bg-slate-50 p-4 rounded-xl border border-slate-250">
                  <span className="uppercase">Total Liabilities & Equities</span>
                  <span className="border-b-4 border-double border-slate-900">
                    KES {balanceSheet.totals.liabilitiesAndEquity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Balancing test check strip */}
              <div className="flex justify-end pt-2 print:hidden">
                {Math.abs(balanceSheet.totals.assets - balanceSheet.totals.liabilitiesAndEquity) < 0.02 ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-[10px] font-bold">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>Balance Sheet Reconciled (Assets = Liabilities + Equity)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg text-[10px] font-bold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Warning: Balance Sheet out of balance by KES {Math.abs(balanceSheet.totals.assets - balanceSheet.totals.liabilitiesAndEquity).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
