import React, { useEffect, useState } from "react";
import { Loader2, FlaskConical, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type { GoodsReceivedNote, QCResult } from "../../modules/procurement/types/procurement";

const fmtNum = (v?: number | string | null, dp = 2) =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function GradePill({ grade }: { grade?: string | null }) {
  if (!grade) return null;
  const map: Record<string, string> = {
    GRADE_A: "bg-emerald-100 text-emerald-700",
    GRADE_B: "bg-amber-100 text-amber-700",
    GRADE_C: "bg-orange-100 text-orange-700",
    REJECT: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[grade] ?? "bg-slate-100 text-slate-600"}`}>
      {grade.replace("_", " ")}
    </span>
  );
}

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
  testedBy: "", moistureContentPct: "", aflatoxinPpb: "",
  rottenBrokenPct: "", foreignMatterPct: "", liveInsectsCount: "",
  acceptedQuantity: "", remarks: "",
};

export function Lab() {
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, QCFormState>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, QCResult>>({});

  const loadGrns = () => {
    void procurementApi.grns
      .list()
      .then((d) => setGrns(d.grns as GoodsReceivedNote[]))
      .catch(() => setGrns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadGrns(); }, []);

  const pending = grns.filter((g) => g.status === "PENDING_QC");

  const getForm = (id: string): QCFormState => forms[id] ?? QC_DEFAULTS;
  const setForm = (id: string, patch: Partial<QCFormState>) =>
    setForms((f) => ({ ...f, [id]: { ...(f[id] ?? QC_DEFAULTS), ...patch } }));

  const handleQCSubmit = async (grn: GoodsReceivedNote) => {
    const f = getForm(grn.id);
    if (!f.testedBy.trim()) { setErrors((e) => ({ ...e, [grn.id]: "Tested by is required." })); return; }
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
        acceptedQuantity: f.acceptedQuantity ? Number(f.acceptedQuantity) : undefined,
        remarks: f.remarks.trim() || undefined,
      });
      setResults((r) => ({ ...r, [grn.id]: (res as { qc: QCResult }).qc }));
      loadGrns();
    } catch (err) {
      setErrors((e) => ({ ...e, [grn.id]: err instanceof Error ? err.message : "QC submission failed." }));
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
      <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
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
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">{unit}</span>
      </div>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-indigo-600" />
          Quality Control Lab
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Test samples · enter moisture, aflatoxin, grade deductions · auto-evaluate pass/fail
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-slate-200 rounded-xl">
          <FlaskConical className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No samples pending QC</p>
          <p className="text-xs">Deliveries will appear here after weighbridge and receiving.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((grn) => {
            const isOpen = expanded === grn.id;
            const f = getForm(grn.id);
            const qcResult = results[grn.id] ?? grn.qcResults?.[0];
            const hasQC = !!qcResult;
            const isRejected = qcResult?.status === "FULL_REJECTION";

            return (
              <div key={grn.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm ${isRejected ? "border-red-200" : "border-slate-200"}`}>
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : grn.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-slate-900 text-sm">{grn.grnNumber}</span>
                    <span className="text-xs text-slate-500">{grn.purchaseOrder?.supplier?.name ?? "—"}</span>
                    <span className="text-xs text-slate-400 font-mono">{grn.batchTraceCode}</span>
                    <StatusBadge status={grn.status} />
                    {hasQC && <GradePill grade={qcResult?.assignedGrade} />}
                    {hasQC && qcResult?.priceDeductionPct && Number(qcResult.priceDeductionPct) > 0 && (
                      <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                        -{fmtNum(qcResult.priceDeductionPct, 1)}% deduction
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400">{fmtDate(grn.receivedAt)}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded QC form */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-5 space-y-5">
                    {/* QC result banner */}
                    {hasQC && (
                      <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-xs ${
                        isRejected
                          ? "bg-red-50 border-red-200 text-red-700"
                          : qcResult?.status === "FAILED_CONDITIONAL"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                      }`}>
                        {isRejected ? <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-bold">{qcResult?.status?.replace(/_/g, " ")}</p>
                          {qcResult?.rejectionNote && <p className="mt-0.5 opacity-80">{qcResult.rejectionNote}</p>}
                          {qcResult?.assignedGrade && <p className="mt-0.5">Grade: <strong>{qcResult.assignedGrade.replace("_", " ")}</strong> · Deduction: <strong>{fmtNum(qcResult.priceDeductionPct, 1)}%</strong></p>}
                        </div>
                      </div>
                    )}

                    {/* Lab entry form */}
                    {!hasQC && (
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Lab Results — Maize / Raw Material</h3>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tested By *</label>
                          <input
                            type="text"
                            value={f.testedBy}
                            onChange={(e) => setForm(grn.id, { testedBy: e.target.value })}
                            placeholder="Lab technician name"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {numInp("Moisture Content", "moistureContentPct", grn.id, "%", "Limit: 14%")}
                          {numInp("Aflatoxin", "aflatoxinPpb", grn.id, "ppb", "Limit: 10 ppb")}
                          {numInp("Rotten / Broken", "rottenBrokenPct", grn.id, "%", "Deduction >3%")}
                          {numInp("Foreign Matter", "foreignMatterPct", grn.id, "%", "Deduction >2%")}
                          {numInp("Live Insects", "liveInsectsCount", grn.id, "count", "Any count = rejection")}
                          {numInp("Accepted Quantity", "acceptedQuantity", grn.id, "kg", "Leave blank to use GRN quantity")}
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Remarks</label>
                          <input
                            type="text"
                            value={f.remarks}
                            onChange={(e) => setForm(grn.id, { remarks: e.target.value })}
                            placeholder="Optional lab notes"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                          />
                        </div>
                      </div>
                    )}

                    {errors[grn.id] && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {errors[grn.id]}
                      </div>
                    )}

                    {!hasQC && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => { void handleQCSubmit(grn); }}
                          disabled={submitting === grn.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
                        >
                          {submitting === grn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
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
      )}
    </div>
  );
}
