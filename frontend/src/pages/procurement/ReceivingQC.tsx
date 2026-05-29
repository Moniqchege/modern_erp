import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, Truck, FlaskConical, CheckCircle2, ChevronDown, ChevronUp,
  AlertTriangle, XCircle, PackageCheck, Scale, ClipboardList,
} from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type {
  GoodsReceivedNote, PurchaseOrder, QCResult,
} from "../../modules/procurement/types/procurement";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtNum = (v?: number | string | null, dp = 2) =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

type Tab = "inbound" | "qc" | "accepted";

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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[grade] ?? "bg-slate-100 text-slate-600"}`}>
      {grade.replace("_", " ")}
    </span>
  );
}

// ─── Page 1: Inbound Receiving ────────────────────────────────────────────────

interface InboundFormState {
  purchaseOrderId: string;
  truckRegistration: string;
  driverName: string;
  grossWeightKg: string;
  tareWeightKg: string;
  operatorName: string;
  receivedBy: string;
  sampleCollected: boolean;
  notes: string;
}

const INBOUND_DEFAULTS: InboundFormState = {
  purchaseOrderId: "",
  truckRegistration: "",
  driverName: "",
  grossWeightKg: "",
  tareWeightKg: "",
  operatorName: "",
  receivedBy: "",
  sampleCollected: false,
  notes: "",
};

function InboundReceiving({ onSubmitted }: { onSubmitted: () => void }) {
  const [issuedPOs, setIssuedPOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<(PurchaseOrder & { lines?: unknown[] }) | null>(null);
  const [form, setForm] = useState<InboundFormState>(INBOUND_DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void procurementApi.purchaseOrders
      .list()
      .then((d) => {
        const pos = (d.purchaseOrders as PurchaseOrder[]).filter(
          (p) => p.status === "ISSUED" || p.status === "PARTIALLY_RECEIVED"
        );
        setIssuedPOs(pos);
      })
      .catch(() => setIssuedPOs([]));
  }, []);

  const handlePOChange = async (poId: string) => {
    setForm((f) => ({ ...f, purchaseOrderId: poId }));
    if (!poId) { setSelectedPO(null); return; }
    try {
      const d = await procurementApi.purchaseOrders.get(poId);
      setSelectedPO(d.purchaseOrder as PurchaseOrder & { lines?: unknown[] });
    } catch {
      setSelectedPO(null);
    }
  };

  const netWeight =
    form.grossWeightKg && form.tareWeightKg
      ? Number(form.grossWeightKg) - Number(form.tareWeightKg)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.purchaseOrderId) { setError("Select a Purchase Order."); return; }
    if (!form.truckRegistration.trim()) { setError("Truck registration is required."); return; }
    if (!form.receivedBy.trim()) { setError("Received by is required."); return; }
    if (netWeight !== null && netWeight <= 0) { setError("Net weight must be positive (gross > tare)."); return; }

    setSubmitting(true);
    try {
      // 1. Record weighbridge ticket
      const wbRes = await procurementApi.weighbridge.create({
        purchaseOrderId: form.purchaseOrderId,
        truckRegistration: form.truckRegistration.trim(),
        driverName: form.driverName.trim() || undefined,
        grossWeightKg: Number(form.grossWeightKg),
        tareWeightKg: Number(form.tareWeightKg),
        operatorName: form.operatorName.trim() || undefined,
      });
      const ticketId = (wbRes.ticket as { id: string }).id;

      // 2. Build GRN lines from PO lines
      const po = selectedPO as (PurchaseOrder & {
        lines?: Array<{ id: string; quantity: number | string; unitPrice: number | string; quantityReceived: number | string }>;
      }) | null;
      const lines = (po?.lines ?? []).map((l) => ({
        purchaseOrderLineId: l.id,
        quantityAccepted: Math.max(0, Number(l.quantity) - Number(l.quantityReceived)),
        unitPriceApplied: Number(l.unitPrice),
      })).filter((l) => l.quantityAccepted > 0);

      if (lines.length === 0) {
        setError("No outstanding quantities on this PO.");
        setSubmitting(false);
        return;
      }

      // 3. Create GRN draft
      await procurementApi.grns.create({
        purchaseOrderId: form.purchaseOrderId,
        weighbridgeTicketId: ticketId,
        receivedBy: form.receivedBy.trim(),
        lines,
        notes: form.notes.trim() || undefined,
      });

      setSuccess("Delivery recorded. GRN created and sent to QC queue.");
      setForm(INBOUND_DEFAULTS);
      setSelectedPO(null);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
      {node}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );

  const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white disabled:bg-slate-50 disabled:text-slate-400"
    />
  );

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
      {/* PO Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-indigo-500" /> Purchase Order
        </h2>
        {field(
          "Select Issued PO *",
          <select
            value={form.purchaseOrderId}
            onChange={(e) => { void handlePOChange(e.target.value); }}
            aria-label="Select Issued Purchase Order"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">— choose a PO —</option>
            {issuedPOs.map((po) => (
              <option key={po.id} value={po.id}>
                {po.poNumber} · {po.supplier?.name ?? "Unknown supplier"} · {po.currency} {Number(po.totalAmount).toLocaleString()}
              </option>
            ))}
          </select>
        )}
        {selectedPO && (
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 border border-slate-100">
            <p className="font-semibold text-slate-700">{(selectedPO as { supplier?: { name: string } }).supplier?.name}</p>
            <p className="text-slate-500">Expected: {fmtDate((selectedPO as { expectedDelivery?: string }).expectedDelivery)}</p>
            <div className="mt-2 space-y-1">
              {((selectedPO as { lines?: Array<{ id: string; itemProfile: { name: string; unit: string }; quantity: number | string; quantityReceived: number | string; unitPrice: number | string }> }).lines ?? []).map((l) => (
                <div key={l.id} className="flex justify-between text-slate-600">
                  <span>{l.itemProfile.name}</span>
                  <span className="font-mono">
                    {fmtNum(Number(l.quantity) - Number(l.quantityReceived), 3)} {l.itemProfile.unit} outstanding
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Truck & Weighbridge */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Truck className="h-4 w-4 text-indigo-500" /> Truck & Weighbridge
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {field("Truck Registration *", inp({ value: form.truckRegistration, onChange: (e) => setForm((f) => ({ ...f, truckRegistration: e.target.value })), placeholder: "KAA 000A" }))}
          {field("Driver Name", inp({ value: form.driverName, onChange: (e) => setForm((f) => ({ ...f, driverName: e.target.value })), placeholder: "Optional" }))}
          {field("Gross Weight (kg) *", inp({ type: "number", min: 0, step: "0.001", value: form.grossWeightKg, onChange: (e) => setForm((f) => ({ ...f, grossWeightKg: e.target.value })), placeholder: "e.g. 32000" }))}
          {field("Tare Weight (kg) *", inp({ type: "number", min: 0, step: "0.001", value: form.tareWeightKg, onChange: (e) => setForm((f) => ({ ...f, tareWeightKg: e.target.value })), placeholder: "e.g. 8000" }))}
        </div>
        {netWeight !== null && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${netWeight > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            <Scale className="h-3.5 w-3.5" />
            Net Weight: {fmtNum(netWeight, 3)} kg
          </div>
        )}
        {field("Weighbridge Operator", inp({ value: form.operatorName, onChange: (e) => setForm((f) => ({ ...f, operatorName: e.target.value })), placeholder: "Optional" }))}
      </div>

      {/* Sample & Submission */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-indigo-500" /> Sample Collection & Submission
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {field("Received By *", inp({ value: form.receivedBy, onChange: (e) => setForm((f) => ({ ...f, receivedBy: e.target.value })), placeholder: "Name of receiving officer" }))}
          {field("Notes", inp({ value: form.notes, onChange: (e) => setForm((f) => ({ ...f, notes: e.target.value })), placeholder: "Optional delivery notes" }))}
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.sampleCollected}
            onChange={(e) => setForm((f) => ({ ...f, sampleCollected: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
          <span className="text-xs text-slate-700 font-medium">Sample collected and sent to lab for QC</span>
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-3 rounded-lg">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
          Submit for QC
        </button>
      </div>
    </form>
  );
}

// ─── Page 2: QC Review Queue ──────────────────────────────────────────────────

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

function QCReviewQueue({ grns, onRefresh }: { grns: GoodsReceivedNote[]; onRefresh: () => void }) {
  const pending = grns.filter((g) => g.status === "PENDING_QC");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, QCFormState>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [posting, setPosting] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, QCResult>>({});

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
      onRefresh();
    } catch (err) {
      setErrors((e) => ({ ...e, [grn.id]: err instanceof Error ? err.message : "QC submission failed." }));
    } finally {
      setSubmitting(null);
    }
  };

  const handlePost = async (grn: GoodsReceivedNote) => {
    setPosting(grn.id);
    try {
      await procurementApi.grns.post(grn.id, "QC_OFFICER");
      onRefresh();
    } catch (err) {
      setErrors((e) => ({ ...e, [grn.id]: err instanceof Error ? err.message : "Post failed." }));
    } finally {
      setPosting(null);
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

  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
        <FlaskConical className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No deliveries pending QC</p>
        <p className="text-xs">Submit an inbound delivery first.</p>
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
        const canPost = hasQC && !qcResult.blocksInventoryPost;
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

                <div className="flex items-center gap-3 pt-1">
                  {!hasQC && (
                    <button
                      type="button"
                      onClick={() => { void handleQCSubmit(grn); }}
                      disabled={submitting === grn.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {submitting === grn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                      Submit QC Results
                    </button>
                  )}
                  {canPost && (
                    <button
                      type="button"
                      onClick={() => { void handlePost(grn); }}
                      disabled={posting === grn.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {posting === grn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve & Post GRN
                    </button>
                  )}
                  {isRejected && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                      <XCircle className="h-3.5 w-3.5" /> Rejected — cannot post
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page 3: Accepted Deliveries ─────────────────────────────────────────────

function AcceptedDeliveries({ grns }: { grns: GoodsReceivedNote[] }) {
  const posted = grns.filter((g) => g.status === "POSTED");

  if (posted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
        <PackageCheck className="h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No accepted deliveries yet</p>
        <p className="text-xs">Posted GRNs will appear here with their inventory transactions.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-slate-50 uppercase text-slate-500 font-semibold tracking-wider border-b border-slate-200">
          <tr>
            <th className="px-4 py-3">GRN</th>
            <th className="px-4 py-3">PO</th>
            <th className="px-4 py-3">Supplier</th>
            <th className="px-4 py-3">Batch / Lot</th>
            <th className="px-4 py-3 text-right">Net Weight (kg)</th>
            <th className="px-4 py-3 text-center">QC Grade</th>
            <th className="px-4 py-3 text-right">Price Deduction</th>
            <th className="px-4 py-3">Posted</th>
            <th className="px-4 py-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {posted.map((grn) => {
            const qc = grn.qcResults?.[0];
            return (
              <tr key={grn.id} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-slate-900">{grn.grnNumber}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{grn.purchaseOrder?.poNumber ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{grn.purchaseOrder?.supplier?.name ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{grn.batchTraceCode ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                  {fmtNum(grn.netWeightAccepted, 3)}
                </td>
                <td className="px-4 py-3 text-center">
                  <GradePill grade={qc?.assignedGrade} />
                </td>
                <td className="px-4 py-3 text-right">
                  {qc && Number(qc.priceDeductionPct) > 0 ? (
                    <span className="text-orange-600 font-bold">-{fmtNum(qc.priceDeductionPct, 1)}%</span>
                  ) : (
                    <span className="text-emerald-600 font-bold">None</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(grn.postedAt)}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={grn.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1.5">
        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        GRN posting automatically creates inventory transactions and updates stock ledger balances.
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "inbound",
    label: "Inbound Receiving",
    icon: <Truck className="h-4 w-4" />,
    description: "Record truck, weighbridge & submit for QC",
  },
  {
    id: "qc",
    label: "QC Review Queue",
    icon: <FlaskConical className="h-4 w-4" />,
    description: "Lab enters results · approve or reject",
  },
  {
    id: "accepted",
    label: "Accepted Deliveries",
    icon: <PackageCheck className="h-4 w-4" />,
    description: "Posted GRNs · inventory transactions · stock ledger",
  },
];

export function ReceivingQC() {
  const [activeTab, setActiveTab] = useState<Tab>("inbound");
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGrns = useCallback(() => {
    void procurementApi.grns
      .list()
      .then((d) => setGrns(d.grns as GoodsReceivedNote[]))
      .catch(() => setGrns([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGrns(); }, [loadGrns]);

  const pendingQCCount = grns.filter((g) => g.status === "PENDING_QC").length;
  const postedCount = grns.filter((g) => g.status === "POSTED").length;

  const counts: Record<Tab, number | null> = {
    inbound: null,
    qc: pendingQCCount,
    accepted: postedCount,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-black text-slate-900">Receiving, Weighbridge & QC</h1>
        <p className="text-xs text-slate-500 mt-1">
          GRN blocked until lab signs off moisture, aflatoxin, and grade deductions
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.icon}
            {tab.label}
            {counts[tab.id] !== null && counts[tab.id]! > 0 && (
              <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-black ${
                tab.id === "qc" ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
              }`}>
                {counts[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-xs text-slate-400 -mt-2">
        {TABS.find((t) => t.id === activeTab)?.description}
      </p>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {activeTab === "inbound" && (
            <InboundReceiving onSubmitted={() => { loadGrns(); setActiveTab("qc"); }} />
          )}
          {activeTab === "qc" && (
            <QCReviewQueue grns={grns} onRefresh={loadGrns} />
          )}
          {activeTab === "accepted" && (
            <AcceptedDeliveries grns={grns} />
          )}
        </>
      )}
    </div>
  );
}
