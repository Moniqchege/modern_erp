import React, { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type {
  GoodsReceivedNote,
  ThreeWayMatch as TWMatch,
  PaymentVoucher,
} from "../../modules/procurement/types/procurement";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMoney = (v?: string | number | null, currency = "KES") =>
  v == null ? "—" : `${currency} ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v?: string | number | null) =>
  v == null ? "—" : `${Number(v).toFixed(2)}%`;

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const VARIANCE_THRESHOLD = 1; // percent

// ─── Match status colour helper ───────────────────────────────────────────────

function varianceClass(pct?: string | number | null) {
  const n = Number(pct ?? 0);
  if (n > VARIANCE_THRESHOLD) return "text-red-600 font-bold";
  if (n > 0) return "text-amber-600";
  return "text-emerald-600";
}

// ─── Past matches list ────────────────────────────────────────────────────────

function PastMatchRow({ match, onRefresh }: { match: TWMatch; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [pushingAP, setPushingAP] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const voucher: PaymentVoucher | undefined = match.paymentVouchers?.[0];
  const currency = match.supplierInvoice?.currency ?? "KES";

  const handleApprove = async () => {
    setErr(null);
    setApproving(true);
    try {
      await procurementApi.finance.approvePayment(match.id, "Finance Director");
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handlePushAP = async () => {
    if (!voucher) return;
    setErr(null);
    setPushingAP(true);
    try {
      await procurementApi.finance.pushAP(voucher.id);
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AP push failed");
    } finally {
      setPushingAP(false);
    }
  };

  const isRejected = match.status === "PRICE_DISCREPANCY" || match.status === "QUANTITY_DISCREPANCY" || match.status === "BOTH_DISCREPANCY";

  return (
    <div className={`bg-white border rounded-xl overflow-hidden shadow-sm ${isRejected ? "border-amber-200" : "border-slate-200"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors text-left"
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono font-bold text-slate-900 text-sm">{match.matchNumber}</span>
          <span className="text-xs text-slate-500">{match.grn?.purchaseOrder?.supplier?.name ?? "—"}</span>
          <span className="text-xs font-mono text-slate-400">{match.grn?.grnNumber ?? "—"}</span>
          <span className="text-xs font-mono text-slate-400">{match.supplierInvoice?.invoiceNumber ?? "—"}</span>
          <StatusBadge status={match.status} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono font-bold text-slate-700">{fmtMoney(match.invoiceTotal, currency)}</span>
          <span className="text-[10px] text-slate-400">{fmtDate(match.matchedAt ?? match.createdAt)}</span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-4">
          {/* Totals comparison */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "PO Total", value: match.poTotal },
              { label: "GRN Total", value: match.grnTotal },
              { label: "Invoice Total", value: match.invoiceTotal },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-black font-mono text-slate-900">{fmtMoney(value, currency)}</p>
              </div>
            ))}
          </div>

          {/* Variance */}
          <div className="flex gap-6 text-xs">
            <div>
              <span className="text-slate-500">Price variance: </span>
              <span className={varianceClass(match.priceVariancePct)}>{fmtPct(match.priceVariancePct)}</span>
            </div>
            <div>
              <span className="text-slate-500">Qty variance: </span>
              <span className={varianceClass(match.quantityVariancePct)}>{fmtPct(match.quantityVariancePct)}</span>
            </div>
            <div>
              <span className="text-slate-500">Tolerance: </span>
              <span className="text-slate-700">{fmtPct(match.tolerancePct)}</span>
            </div>
          </div>

          {match.discrepancyNotes && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {match.discrepancyNotes}
            </div>
          )}

          {/* Invoice details */}
          <div className="text-xs text-slate-600 grid grid-cols-3 gap-2">
            <div><span className="text-slate-400">Invoice #: </span><span className="font-mono font-semibold">{match.supplierInvoice?.invoiceNumber}</span></div>
            <div><span className="text-slate-400">Invoice Date: </span>{fmtDate(match.supplierInvoice?.invoiceDate)}</div>
            <div><span className="text-slate-400">Due: </span>{fmtDate(match.supplierInvoice?.dueDate)}</div>
            <div><span className="text-slate-400">Subtotal: </span><span className="font-mono">{fmtMoney(match.supplierInvoice?.subtotal, currency)}</span></div>
            <div><span className="text-slate-400">VAT: </span><span className="font-mono">{fmtMoney(match.supplierInvoice?.taxAmount, currency)}</span></div>
            <div><span className="text-slate-400">Total: </span><span className="font-mono font-bold">{fmtMoney(match.supplierInvoice?.totalAmount, currency)}</span></div>
          </div>

          {/* Voucher & AP actions */}
          {err && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              <XCircle className="h-3.5 w-3.5 shrink-0" /> {err}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            {match.status === "MATCHED" && !voucher && (
              <button
                type="button"
                onClick={() => { void handleApprove(); }}
                disabled={approving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-60"
              >
                {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Approve for Payment
              </button>
            )}
            {voucher && voucher.status === "DRAFT" && (
              <button
                type="button"
                onClick={() => { void handlePushAP(); }}
                disabled={pushingAP}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
              >
                {pushingAP ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Push to AP Queue
              </button>
            )}
            {voucher && (
              <div className="text-xs text-slate-600">
                <span className="text-slate-400">Voucher: </span>
                <span className="font-mono font-semibold">{voucher.voucherNumber}</span>
                <span className="ml-2"><StatusBadge status={voucher.status} /></span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New match form ───────────────────────────────────────────────────────────

interface MatchFormState {
  grnId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  matchedBy: string;
  invoiceFileName: string | null;
}

const FORM_DEFAULTS: MatchFormState = {
  grnId: "", invoiceNumber: "", invoiceDate: "", dueDate: "",
  subtotal: "", taxAmount: "", totalAmount: "", matchedBy: "",
  invoiceFileName: null,
};

function NewMatchForm({ postedGrns, onCreated }: {
  postedGrns: GoodsReceivedNote[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState<MatchFormState>(FORM_DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TWMatch | null>(null);

  const selectedGrn = postedGrns.find((g) => g.id === form.grnId);
  const currency = selectedGrn?.purchaseOrder?.currency ?? "KES";

  // Auto-calc total from subtotal + tax
  const derivedTotal =
    form.subtotal && form.taxAmount
      ? (Number(form.subtotal) + Number(form.taxAmount)).toFixed(2)
      : form.totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!form.grnId) { setError("Select a posted GRN."); return; }
    if (!form.invoiceNumber.trim()) { setError("Invoice number is required."); return; }
    if (!form.invoiceDate) { setError("Invoice date is required."); return; }
    if (!form.matchedBy.trim()) { setError("Matched by is required."); return; }
    const total = Number(derivedTotal);
    if (!total || total <= 0) { setError("Invoice total must be greater than zero."); return; }

    setSubmitting(true);
    try {
      const res = await procurementApi.finance.registerAndMatch({
        grnId: form.grnId,
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        subtotal: Number(form.subtotal) || 0,
        taxAmount: Number(form.taxAmount) || 0,
        totalAmount: total,
        matchedBy: form.matchedBy.trim(),
        tolerancePct: VARIANCE_THRESHOLD,
      });
      setResult(res.match as TWMatch);
      setForm(FORM_DEFAULTS);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white disabled:bg-slate-50"
    />
  );

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
      {node}
    </div>
  );

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
      {/* GRN selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800">Step 1 — Select Posted GRN</h3>
        {field(
          "Posted GRN *",
          <select
            value={form.grnId}
            onChange={(e) => setForm((f) => ({ ...f, grnId: e.target.value }))}
            aria-label="Select Posted GRN"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">— choose a GRN —</option>
            {postedGrns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.grnNumber} · {g.purchaseOrder?.supplier?.name ?? "—"} · {g.purchaseOrder?.poNumber ?? "—"} · {fmtDate(g.postedAt)}
              </option>
            ))}
          </select>
        )}
        {selectedGrn && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs grid grid-cols-3 gap-2">
            <div><span className="text-slate-400">Batch: </span><span className="font-mono font-semibold">{selectedGrn.batchTraceCode}</span></div>
            <div><span className="text-slate-400">Net weight: </span><span className="font-mono font-semibold">{Number(selectedGrn.netWeightAccepted ?? 0).toLocaleString()} kg</span></div>
            <div><span className="text-slate-400">PO total: </span><span className="font-mono font-semibold">{fmtMoney(selectedGrn.purchaseOrder?.totalAmount, currency)}</span></div>
            <div><span className="text-slate-400">GRN lines total: </span><span className="font-mono font-semibold">{fmtMoney(selectedGrn.lines?.reduce((s, l) => s + Number(l.lineTotal), 0), currency)}</span></div>
          </div>
        )}
      </div>

      {/* Invoice details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800">Step 2 — Supplier Invoice Details</h3>
        <p className="text-[11px] text-slate-400">Enter details from the physical invoice received from the supplier.</p>
        <div className="grid grid-cols-2 gap-4">
          {field("Invoice Number *", inp({ value: form.invoiceNumber, onChange: (e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value })), placeholder: "e.g. INV-2026-00142" }))}
          {field("Matched By *", inp({ value: form.matchedBy, onChange: (e) => setForm((f) => ({ ...f, matchedBy: e.target.value })), placeholder: "Finance officer name" }))}
          {field("Invoice Date *", inp({ type: "date", value: form.invoiceDate, onChange: (e) => setForm((f) => ({ ...f, invoiceDate: e.target.value })) }))}
          {field("Due Date", inp({ type: "date", value: form.dueDate, onChange: (e) => setForm((f) => ({ ...f, dueDate: e.target.value })) }))}
          {field(`Subtotal (${currency})`, inp({ type: "number", min: 0, step: "0.01", value: form.subtotal, onChange: (e) => setForm((f) => ({ ...f, subtotal: e.target.value })), placeholder: "0.00" }))}
          {field(`VAT / Tax (${currency})`, inp({ type: "number", min: 0, step: "0.01", value: form.taxAmount, onChange: (e) => setForm((f) => ({ ...f, taxAmount: e.target.value })), placeholder: "0.00" }))}
        </div>
        {derivedTotal && Number(derivedTotal) > 0 && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-4 py-2.5 rounded-lg font-bold">
            Invoice Total: {fmtMoney(derivedTotal, currency)}
          </div>
        )}

        {/* File upload */}
        <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-700">Invoice attachment</p>
            <p className="text-[10px] text-slate-500">Upload scanned invoice / PDF for audit trail.</p>
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold cursor-pointer hover:bg-slate-50">
            <FileText className="h-3.5 w-3.5" /> Upload file
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setForm((f) => ({ ...f, invoiceFileName: e.target.files?.[0]?.name ?? null }))}
            />
          </label>
        </div>
        {form.invoiceFileName && (
          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> {form.invoiceFileName}
          </p>
        )}
      </div>

      {/* Match info callout */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-[11px] text-amber-700">
        <strong>Tolerance: {VARIANCE_THRESHOLD}%.</strong> Flags price or quantity variance above this threshold. Matched GRNs with conditional QC deductions will show adjusted totals.
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-xs ${
          result.status === "MATCHED"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
        }`}>
          {result.status === "MATCHED"
            ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
          <div>
            <p className="font-bold">{result.matchNumber} — {result.status.replace(/_/g, " ")}</p>
            {result.discrepancyNotes && <p className="mt-0.5 opacity-80">{result.discrepancyNotes}</p>}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Run 3-Way Match
        </button>
      </div>
    </form>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

type Tab = "new" | "history";

export function ThreeWayMatch() {
  const [tab, setTab] = useState<Tab>("new");
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [matches, setMatches] = useState<TWMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void Promise.all([
      procurementApi.grns.list().then((d) => {
        const all = d.grns as GoodsReceivedNote[];
        setGrns(all.filter((g) => g.status === "POSTED"));
      }),
      procurementApi.finance.listMatches().then((d) => {
        setMatches(d.matches as TWMatch[]);
      }),
    ])
      .catch(() => {/* silent — individual handlers set state to [] */})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingCount = matches.filter(
    (m) => m.status === "MATCHED" && !m.paymentVouchers?.length
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900">3-Way Match & AP</h1>
        <p className="text-xs text-slate-500 mt-1">
          Compare PO ↔ GRN ↔ Supplier Invoice · flags &gt;{VARIANCE_THRESHOLD}% variance · approve for payment
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: "new" as Tab, label: "New Match" },
          { id: "history" as Tab, label: "Match History", count: pendingCount },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-black bg-amber-500 text-white">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {tab === "new" && (
            grns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-slate-200 rounded-xl">
                <FileText className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No posted GRNs available</p>
                <p className="text-xs">GRNs must be posted (inventory updated) before running a 3-way match.</p>
              </div>
            ) : (
              <NewMatchForm postedGrns={grns} onCreated={() => { load(); setTab("history"); }} />
            )
          )}

          {tab === "history" && (
            <div className="space-y-3">
              {matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-slate-200 rounded-xl">
                  <FileText className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">No matches yet</p>
                  <p className="text-xs">Run a 3-way match from the New Match tab.</p>
                </div>
              ) : (
                matches.map((m) => (
                  <PastMatchRow key={m.id} match={m} onRefresh={load} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
