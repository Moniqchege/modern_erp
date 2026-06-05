import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiClient";
import { Plus, BookOpen, Trash2, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
}

interface JournalLine {
  id: string;
  debit: string | number;
  credit: string | number;
  description?: string;
  account: { code: string; name: string };
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  reference?: string;
  description: string;
  date: string;
  status: string;
  createdAt: string;
  lines: JournalLine[];
  createdBy: { name: string };
}

export function JournalEntries() {
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [header, setHeader] = useState({ reference: "", description: "", date: new Date().toISOString().split("T")[0] });
  const [lines, setLines] = useState<{ accountId: string; debit: number; credit: number; description: string }[]>([
    { accountId: "", debit: 0, credit: 0, description: "" },
    { accountId: "", debit: 0, credit: 0, description: "" },
  ]);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [jRes, aRes] = await Promise.all([
        apiFetch("/api/finance/journals"),
        apiFetch("/api/finance/accounts"),
      ]);

      if (jRes.ok && aRes.ok) {
        const jData = await jRes.json();
        const aData = await aRes.json();
        setJournals(jData.journals);
        setAccounts(aData.accounts.filter((a: any) => a.status === "ACTIVE"));
      }
    } catch (err) {
      console.error("Error loading journal data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Manage Dynamic Lines
  const addLine = () => {
    setLines([...lines, { accountId: "", debit: 0, credit: 0, description: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const updateLine = (index: number, key: string, val: any) => {
    const newLines = [...lines];
    if (key === "debit") {
      newLines[index].debit = Number(val);
      if (Number(val) > 0) newLines[index].credit = 0; // double entry safety
    } else if (key === "credit") {
      newLines[index].credit = Number(val);
      if (Number(val) > 0) newLines[index].debit = 0; // double entry safety
    } else {
      (newLines[index] as any)[key] = val;
    }
    setLines(newLines);
  };

  // Compute Balances
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  const isOutOfBalance = Math.abs(totalDebit - totalCredit) > 0.01;

  // Submit Journal Entry
  const handleJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validation
    const emptyAccount = lines.some((l) => !l.accountId);
    if (emptyAccount) {
      setFormError("All journal lines must specify a GL account");
      return;
    }

    if (isOutOfBalance) {
      setFormError(`Debits and Credits must balance. Diff: KES ${Math.abs(totalDebit - totalCredit).toFixed(2)}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/finance/journals", {
        method: "POST",
        body: JSON.stringify({
          ...header,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save journal entry");
      }

      setShowModal(false);
      setHeader({ reference: "", description: "", date: new Date().toISOString().split("T")[0] });
      setLines([
        { accountId: "", debit: 0, credit: 0, description: "" },
        { accountId: "", debit: 0, credit: 0, description: "" },
      ]);
      loadData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Post Draft Entry
  const handlePostEntry = async (id: string) => {
    try {
      const res = await apiFetch(`/api/finance/journals/${id}/post`, { method: "POST" });
      if (res.ok) {
        loadData();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to post entry");
      }
    } catch (err) {
      console.error("Error posting entry:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Journal Entries</h1>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile double-entry ledger transactions and post manual adjustment journals.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/25 transition animate-pulse-slow"
        >
          <Plus className="h-4 w-4" />
          <span>Record Journal Entry</span>
        </button>
      </div>

      {/* LIST LISTINGS */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/70">
                <th className="p-4 uppercase tracking-wider text-[10px] w-12"></th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Journal ID</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Description</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-right">Debit Total (KES)</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-right">Credit Total (KES)</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-center w-28">Status</th>
                <th className="p-4 uppercase tracking-wider text-[10px] w-24">Date</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">Loading journals...</td>
                </tr>
              ) : journals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">No journal entries found.</td>
                </tr>
              ) : (
                journals.map((j) => {
                  const debSum = j.lines.reduce((sum, l) => sum + Number(l.debit), 0);
                  const credSum = j.lines.reduce((sum, l) => sum + Number(l.credit), 0);
                  const isExpanded = expandedId === j.id;

                  return (
                    <React.Fragment key={j.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : j.id)}
                        className="hover:bg-slate-50/60 transition cursor-pointer"
                      >
                        <td className="p-4 font-bold text-slate-400 text-center">{isExpanded ? "▼" : "▶"}</td>
                        <td className="p-4 font-mono font-bold text-slate-900">
                          {j.entryNumber}
                          {j.reference && <span className="text-[10px] font-normal text-slate-450 block">Ref: {j.reference}</span>}
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-800">{j.description}</span>
                          <span className="text-[10px] text-slate-400 block font-medium">Recorded by {j.createdBy.name}</span>
                        </td>
                        <td className="p-4 text-right font-semibold text-slate-800">
                          {debSum.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-semibold text-slate-800">
                          {credSum.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 border rounded-full uppercase ${
                              j.status === "POSTED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-250/50"
                                : "bg-amber-50 text-amber-700 border-amber-250/50"
                            }`}
                          >
                            {j.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 font-medium">{new Date(j.date).toLocaleDateString()}</td>
                        <td className="p-4 text-center">
                          {j.status === "DRAFT" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostEntry(j.id);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow"
                            >
                              Post Entry
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Posted</span>
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* EXPANDED DETAILS */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={8} className="p-4">
                            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-inner max-w-4xl mx-auto my-1">
                              <table className="w-full text-left border-collapse text-[11px] font-semibold text-slate-700">
                                <thead>
                                  <tr className="border-b border-slate-100 bg-slate-50 font-extrabold text-slate-400">
                                    <th className="p-2.5 w-24">Code</th>
                                    <th className="p-2.5">Account Name</th>
                                    <th className="p-2.5 text-right w-32">Debit (KES)</th>
                                    <th className="p-2.5 text-right w-32">Credit (KES)</th>
                                    <th className="p-2.5">Line Narration</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {j.lines.map((l) => (
                                    <tr key={l.id} className="hover:bg-slate-50/50">
                                      <td className="p-2.5 font-mono text-slate-900">{l.account.code}</td>
                                      <td className="p-2.5 font-bold text-slate-800">{l.account.name}</td>
                                      <td className="p-2.5 text-right text-slate-900">
                                        {Number(l.debit) > 0 ? Number(l.debit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                                      </td>
                                      <td className="p-2.5 text-right text-slate-900">
                                        {Number(l.credit) > 0 ? Number(l.credit).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "-"}
                                      </td>
                                      <td className="p-2.5 text-slate-450 italic">{l.description || "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD JOURNAL ENTRY MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Create General Ledger Journal</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormError("");
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleJournalSubmit} className="space-y-4 text-xs font-bold text-slate-750">
              {/* HEADER DATA */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label>Posting Date</label>
                  <input
                    type="date"
                    required
                    value={header.date}
                    onChange={(e) => setHeader({ ...header, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label>Document Reference</label>
                  <input
                    type="text"
                    placeholder="Invoice #, Voucher #"
                    value={header.reference}
                    onChange={(e) => setHeader({ ...header, reference: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label>Journal Description</label>
                  <input
                    type="text"
                    required
                    placeholder="General description/narration..."
                    value={header.description}
                    onChange={(e) => setHeader({ ...header, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* DYNAMIC LINE BUILDER */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Journal Ledger Lines</span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>＋ Add Row</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                      {/* Account select */}
                      <div className="col-span-4 space-y-1">
                        <select
                          required
                          value={line.accountId}
                          onChange={(e) => updateLine(index, "accountId", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold focus:outline-none"
                        >
                          <option value="">-- Select GL Account --</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Debit input */}
                      <div className="col-span-2 space-y-1">
                        <input
                          type="number"
                          placeholder="Debit"
                          value={line.debit || ""}
                          onChange={(e) => updateLine(index, "debit", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-right font-bold focus:outline-none"
                        />
                      </div>

                      {/* Credit input */}
                      <div className="col-span-2 space-y-1">
                        <input
                          type="number"
                          placeholder="Credit"
                          value={line.credit || ""}
                          onChange={(e) => updateLine(index, "credit", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-right font-bold focus:outline-none"
                        />
                      </div>

                      {/* Line narration */}
                      <div className="col-span-3 space-y-1">
                        <input
                          type="text"
                          placeholder="Line narration..."
                          value={line.description}
                          onChange={(e) => updateLine(index, "description", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold focus:outline-none"
                        />
                      </div>

                      {/* Delete row */}
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 2}
                          className="text-slate-400 hover:text-rose-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SUMMARY BOX */}
              <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center text-xs font-bold">
                <div className="flex gap-6">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Total Debits</span>
                    <span className="text-slate-800 text-sm">KES {totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Total Credits</span>
                    <span className="text-slate-800 text-sm">KES {totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {isOutOfBalance ? (
                  <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg text-[10px]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Out of balance: KES {Math.abs(totalDebit - totalCredit).toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-[10px]">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Journal Balanced</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || isOutOfBalance}
                className="w-full bg-blue-600 disabled:bg-slate-250 text-white p-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20"
              >
                {submitting ? "Saving..." : "Save Draft Journal Entry"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
