import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type {
  GoodsReceivedNote,
  QCResult,
  LabQCResult,
} from "../../modules/procurement/types/procurement";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtNum = (v?: number | string | null, dp = 2) =>
  v == null
    ? "—"
    : Number(v).toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      });

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// ─── Grade pill ───────────────────────────────────────────────────────────────

function GradePill({ grade }: { grade?: string | null }) {
  if (!grade) return null;
  const map: Record<string, string> = {
    GRADE_A: "bg-emerald-100 text-emerald-700",
    GRADE_B: "bg-amber-100 text-amber-700",
    GRADE_C: "bg-orange-100 text-orange-700",
    REJECT: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
        map[grade] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {grade.replace("_", " ")}
    </span>
  );
}

// ─── QC status badge ──────────────────────────────────────────────────────────

const QC_STATUS_STYLES: Record<string, string> = {
  PASSED: "bg-emerald-100 text-emerald-700",
  FAILED_CONDITIONAL: "bg-amber-100 text-amber-700",
  FULL_REJECTION: "bg-red-100 text-red-700",
  PENDING: "bg-slate-100 text-slate-600",
};

function QcBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const cls = QC_STATUS_STYLES[status] ?? "bg-slate-100 text-slate-500";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── QC form state ────────────────────────────────────────────────────────────

interface QCFormState {
  testedBy: string;
  moistureContentPct: string;
  aflatoxinPpb: string;
  rottenBrokenPct: string;
  foreignMatterPct: string;
  liveInsectsCount: string;
  acceptedQuantity: string;
  remarks: string;
}

const QC_DEFAULTS: QCFormState = {
  testedBy: "",
  moistureContentPct: "",
  aflatoxinPpb: "",
  rottenBrokenPct: "",
  foreignMatterPct: "",
  liveInsectsCount: "",
  acceptedQuantity: "",
  remarks: "",
};

// ─── History row ──────────────────────────────────────────────────────────────

const MAX_MOISTURE = 14;
const MAX_AFLATOXIN = 10;

function QCHistoryRow({ result }: { result: LabQCResult }) {
  const [open, setOpen] = useState(false);
  const isRejected = result.status === "FULL_REJECTION";
  const isConditional = result.status === "FAILED_CONDITIONAL";

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden shadow-sm ${
        isRejected
          ? "border-red-200"
          : isConditional
          ? "border-amber-200"
          : "border-slate-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors text-left"
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono font-bold text-slate-900 text-sm">
            {result.qcNumber}
          </span>
          {result.grn?.purchaseOrder?.supplier?.name && (
            <span className="text-xs text-slate-500">
              {result.grn.purchaseOrder.supplier.name}
            </span>
          )}
          {result.grn?.grnNumber && (
            <span className="text-xs font-mono text-slate-400">
              {result.grn.grnNumber}
            </span>
          )}
          <QcBadge status={result.status} />
          {result.assignedGrade && (
            <GradePill grade={result.assignedGrade} />
          )}
          {result.priceDeductionPct &&
            Number(result.priceDeductionPct) > 0 && (
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                -{fmtNum(result.priceDeductionPct, 1)}% deduction
              </span>
            )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-slate-400">
            By: {result.testedBy}
          </span>
          <span className="text-[10px] text-slate-400">
            {fmtDateTime(result.testedAt)}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Moisture",
                value:
                  result.moistureContentPct != null
                    ? `${Number(result.moistureContentPct).toFixed(2)}%`
                    : "—",
                limit: MAX_MOISTURE,
                raw: result.moistureContentPct,
              },
              {
                label: "Aflatoxin",
                value:
                  result.aflatoxinPpb != null
                    ? `${Number(result.aflatoxinPpb).toFixed(2)} ppb`
                    : "—",
                limit: MAX_AFLATOXIN,
                raw: result.aflatoxinPpb,
              },
              {
                label: "Rotten/Broken",
                value:
                  result.rottenBrokenPct != null
                    ? `${Number(result.rottenBrokenPct).toFixed(2)}%`
                    : "—",
                limit: null,
                raw: null,
              },
              {
                label: "Foreign matter",
                value:
                  result.foreignMatterPct != null
                    ? `${Number(result.foreignMatterPct).toFixed(2)}%`
                    : "—",
                limit: null,
                raw: null,
              },
            ].map(({ label, value, limit, raw }) => {
              const exceeded =
                limit != null && raw != null && Number(raw) > limit;
              return (
                <div
                  key={label}
                  className={`rounded-lg p-3 border ${
                    exceeded
                      ? "bg-red-50 border-red-200"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">
                    {label}
                    {limit != null && (
                      <span className="normal-case font-normal ml-1 text-slate-400">
                        (max {limit})
                      </span>
                    )}
                  </p>
                  <p
                    className={`text-sm font-black font-mono ${
                      exceeded ? "text-red-700" : "text-slate-900"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            {result.liveInsectsCount != null && (
              <div>
                <span className="text-slate-400">Live insects: </span>
                <span className="font-medium">{result.liveInsectsCount}</span>
              </div>
            )}
            {result.acceptedQuantity != null && (
              <div>
                <span className="text-slate-400">Accepted qty: </span>
                <span className="font-mono font-medium">
                  {Number(result.acceptedQuantity).toLocaleString()} kg
                </span>
              </div>
            )}
            {result.priceDeductionPct != null &&
              Number(result.priceDeductionPct) > 0 && (
                <div>
                  <span className="text-slate-400">Price deduction: </span>
                  <span className="font-mono font-semibold text-amber-700">
                    {Number(result.priceDeductionPct).toFixed(1)}%
                  </span>
                </div>
              )}
          </div>

          {result.rejectionNote && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {result.rejectionNote}
            </div>
          )}

          {result.remarks && (
            <p className="text-xs text-slate-500 italic">{result.remarks}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QC analysis tab (pending GRNs) ──────────────────────────────────────────

function QCAnalysisTab({
  onSubmitted,
}: {
  onSubmitted: () => void;
}) {
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, QCFormState>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, QCResult>>({});

  const loadGrns = useCallback(() => {
    void procurementApi.grns
      .list()
      .then((d) => setGrns(d.grns as GoodsReceivedNote[]))
      .catch(() => setGrns([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadGrns();
  }, [loadGrns]);

  const pending = grns.filter((g) => g.status === "PENDING_QC");

  const getForm = (id: string): QCFormState => forms[id] ?? QC_DEFAULTS;
  const setForm = (id: string, patch: Partial<QCFormState>) =>
    setForms((f) => ({ ...f, [id]: { ...(f[id] ?? QC_DEFAULTS), ...patch } }));

  const handleQCSubmit = async (grn: GoodsReceivedNote) => {
    const f = getForm(grn.id);
    if (!f.testedBy.trim()) {
      setErrors((e) => ({ ...e, [grn.id]: "Tested by is required." }));
      return;
    }
    setErrors((e) => ({ ...e, [grn.id]: "" }));
    setSubmitting(grn.id);
    try {
      const res = await procurementApi.qc.submitMaize({
        category: "RAW_MATERIAL",
        grnId: grn.id,
        testedBy: f.testedBy.trim(),
        moistureContentPct: Number(f.moistureContentPct),
        aflatoxinPpb: Number(f.aflatoxinPpb),
        rottenBrokenPct: Number(f.rottenBrokenPct),
        foreignMatterPct: Number(f.foreignMatterPct),
        liveInsectsCount: Number(f.liveInsectsCount),
        acceptedQuantity: f.acceptedQuantity
          ? Number(f.acceptedQuantity)
          : undefined,
        remarks: f.remarks.trim() || undefined,
      });
      setResults((r) => ({
        ...r,
        [grn.id]: (res as { qc: QCResult }).qc,
      }));
      loadGrns();
      onSubmitted();
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [grn.id]: err instanceof Error ? err.message : "QC submission failed.",
      }));
    } finally {
      setSubmitting(null);
    }
  };

  const numInp = (
    label: string,
    key: keyof QCFormState,
    grnId: string,
    unit: string,
    hint?: string
  ) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          min={0}
          step="0.01"
          aria-label={label}
          value={getForm(grnId)[key]}
          onChange={(e) => setForm(grnId, { [key]: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
          {unit}
        </span>
      </div>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-slate-200 rounded-xl">
        <FlaskConical className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No samples pending QC</p>
        <p className="text-xs">
          Deliveries will appear here after weighbridge and receiving.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.map((grn) => {
        const isOpen = expanded === grn.id;
        const f = getForm(grn.id);
        const qcResult = results[grn.id] ?? grn.qcResults?.[0];
        const hasQC = !!qcResult;
        const isRejected = qcResult?.status === "FULL_REJECTION";

        return (
          <div
            key={grn.id}
            className={`bg-white border rounded-xl overflow-hidden shadow-sm ${
              isRejected ? "border-red-200" : "border-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : grn.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {grn.grnNumber}
                </span>
                <span className="text-xs text-slate-500">
                  {grn.purchaseOrder?.supplier?.name ?? "—"}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {grn.batchTraceCode}
                </span>
                <StatusBadge status={grn.status} />
                {hasQC && <GradePill grade={qcResult?.assignedGrade} />}
                {hasQC &&
                  qcResult?.priceDeductionPct &&
                  Number(qcResult.priceDeductionPct) > 0 && (
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                      -{fmtNum(qcResult.priceDeductionPct, 1)}% deduction
                    </span>
                  )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">
                  {fmtDate(grn.receivedAt)}
                </span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-5 py-5 space-y-5">
                {hasQC && (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-xs ${
                      isRejected
                        ? "bg-red-50 border-red-200 text-red-700"
                        : qcResult?.status === "FAILED_CONDITIONAL"
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}
                  >
                    {isRejected ? (
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {qcResult?.status?.replace(/_/g, " ")}
                      </p>
                      {qcResult?.rejectionNote && (
                        <p className="mt-0.5 opacity-80">
                          {qcResult.rejectionNote}
                        </p>
                      )}
                      {qcResult?.assignedGrade && (
                        <p className="mt-0.5">
                          Grade:{" "}
                          <strong>
                            {qcResult.assignedGrade.replace("_", " ")}
                          </strong>{" "}
                          · Deduction:{" "}
                          <strong>
                            {fmtNum(qcResult.priceDeductionPct, 1)}%
                          </strong>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {!hasQC && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Lab Results — Maize / Raw Material
                    </h3>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Tested By *
                      </label>
                      <input
                        type="text"
                        value={f.testedBy}
                        onChange={(e) =>
                          setForm(grn.id, { testedBy: e.target.value })
                        }
                        placeholder="Lab technician name"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {numInp(
                        "Moisture Content",
                        "moistureContentPct",
                        grn.id,
                        "%",
                        "Limit: 14%"
                      )}
                      {numInp(
                        "Aflatoxin",
                        "aflatoxinPpb",
                        grn.id,
                        "ppb",
                        "Limit: 10 ppb"
                      )}
                      {numInp(
                        "Rotten / Broken",
                        "rottenBrokenPct",
                        grn.id,
                        "%",
                        "Deduction >3%"
                      )}
                      {numInp(
                        "Foreign Matter",
                        "foreignMatterPct",
                        grn.id,
                        "%",
                        "Deduction >2%"
                      )}
                      {numInp(
                        "Live Insects",
                        "liveInsectsCount",
                        grn.id,
                        "count",
                        "Any count = rejection"
                      )}
                      {numInp(
                        "Accepted Quantity",
                        "acceptedQuantity",
                        grn.id,
                        "kg",
                        "Leave blank to use GRN quantity"
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Remarks
                      </label>
                      <input
                        type="text"
                        value={f.remarks}
                        onChange={(e) =>
                          setForm(grn.id, { remarks: e.target.value })
                        }
                        placeholder="Optional lab notes"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                      />
                    </div>
                  </div>
                )}

                {errors[grn.id] && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{" "}
                    {errors[grn.id]}
                  </div>
                )}

                {!hasQC && (
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        void handleQCSubmit(grn);
                      }}
                      disabled={submitting === grn.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {submitting === grn.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FlaskConical className="h-3.5 w-3.5" />
                      )}
                      Submit QC Results
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab({ refresh }: { refresh: number }) {
  const [results, setResults] = useState<LabQCResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    procurementApi.qc
      .listResults("RAW_MATERIAL")
      .then((d) => setResults(d.results as LabQCResult[]))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-slate-200 rounded-xl">
        <FlaskConical className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No lab results yet</p>
        <p className="text-xs">
          Submit a QC analysis from the QC Analysis tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400 font-medium">
        {results.length} result{results.length !== 1 ? "s" : ""} — most recent
        first
      </p>
      {results.map((r) => (
        <QCHistoryRow key={r.id} result={r} />
      ))}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type Tab = "analysis" | "history";

export function Lab() {
  const [tab, setTab] = useState<Tab>("analysis");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "analysis", label: "QC Analysis", icon: FlaskConical },
    { id: "history", label: "Analysis History", icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-indigo-600" />
          Quality Control Lab
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Test samples · enter moisture, aflatoxin, grade deductions ·
          auto-evaluate pass/fail
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "analysis" && (
        <QCAnalysisTab
          onSubmitted={() => setHistoryRefresh((n) => n + 1)}
        />
      )}
      {tab === "history" && <HistoryTab refresh={historyRefresh} />}
    </div>
  );
}