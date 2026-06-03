import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2, Truck, Scale, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, History, XCircle,
} from "lucide-react";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type { PurchaseOrder, WeighbridgeTicket } from "../../modules/procurement/types/procurement";

const fmtNum = (v?: number | string | null, dp = 2) =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("en-KE", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

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
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── History row ──────────────────────────────────────────────────────────────

function TicketHistoryRow({ ticket }: { ticket: WeighbridgeTicket }) {
  const [open, setOpen] = useState(false);
  const latestQc = ticket.qcResults?.[0];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors text-left"
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono font-bold text-slate-900 text-sm">{ticket.ticketNumber}</span>
          <span className="text-xs text-slate-600 font-medium">{ticket.truckRegistration}</span>
          {ticket.purchaseOrder?.supplier?.name && (
            <span className="text-xs text-slate-500">{ticket.purchaseOrder.supplier.name}</span>
          )}
          {ticket.purchaseOrder?.poNumber && (
            <span className="text-xs font-mono text-slate-400">{ticket.purchaseOrder.poNumber}</span>
          )}
          {latestQc ? (
            <QcBadge status={latestQc.status} />
          ) : (
            <span className="text-[10px] text-slate-400 italic">No QC yet</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-slate-700">
            {fmtNum(ticket.netWeightKg, 3)} kg net
          </span>
          <span className="text-[10px] text-slate-400">{fmtDate(ticket.weighedInAt)}</span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-4">
          {/* Weight breakdown */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Gross weight", value: `${fmtNum(ticket.grossWeightKg, 3)} kg` },
              { label: "Tare weight", value: `${fmtNum(ticket.tareWeightKg, 3)} kg` },
              { label: "Net weight", value: `${fmtNum(ticket.netWeightKg, 3)} kg` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-black font-mono text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div><span className="text-slate-400">Driver: </span><span className="font-medium">{ticket.driverName ?? "—"}</span></div>
            <div><span className="text-slate-400">Operator: </span><span className="font-medium">{ticket.operatorName ?? "—"}</span></div>
            <div><span className="text-slate-400">Weighed in: </span><span className="font-medium">{fmtDate(ticket.weighedInAt)}</span></div>
            <div><span className="text-slate-400">Weighed out: </span><span className="font-medium">{fmtDate(ticket.weighedOutAt)}</span></div>
          </div>

          {/* QC summary */}
          {latestQc && (
            <div className={`rounded-lg border px-4 py-3 text-xs space-y-2 ${
              latestQc.status === "PASSED" ? "bg-emerald-50 border-emerald-200"
              : latestQc.status === "FULL_REJECTION" ? "bg-red-50 border-red-200"
              : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-center gap-2">
                {latestQc.status === "PASSED"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  : latestQc.status === "FULL_REJECTION"
                  ? <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                <span className="font-bold text-slate-800">
                  QC {latestQc.qcNumber} — <QcBadge status={latestQc.status} />
                </span>
                <span className="text-slate-500 ml-auto">by {latestQc.testedBy}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-slate-600">
                {latestQc.moistureContentPct != null && (
                  <div><span className="text-slate-400">Moisture: </span><span className="font-mono font-semibold">{Number(latestQc.moistureContentPct).toFixed(2)}%</span></div>
                )}
                {latestQc.aflatoxinPpb != null && (
                  <div><span className="text-slate-400">Aflatoxin: </span><span className="font-mono font-semibold">{Number(latestQc.aflatoxinPpb).toFixed(2)} ppb</span></div>
                )}
                {latestQc.assignedGrade && (
                  <div><span className="text-slate-400">Grade: </span><span className="font-semibold">{latestQc.assignedGrade}</span></div>
                )}
                {latestQc.priceDeductionPct != null && Number(latestQc.priceDeductionPct) > 0 && (
                  <div><span className="text-slate-400">Deduction: </span><span className="font-mono font-semibold text-amber-700">{Number(latestQc.priceDeductionPct).toFixed(1)}%</span></div>
                )}
              </div>
              {latestQc.rejectionNote && (
                <p className="text-red-700 font-medium">{latestQc.rejectionNote}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entry form ───────────────────────────────────────────────────────────────

interface WeighbridgeFormState {
  purchaseOrderId: string;
  truckRegistration: string;
  driverName: string;
  grossWeightKg: string;
  tareWeightKg: string;
  operatorName: string;
}

const DEFAULTS: WeighbridgeFormState = {
  purchaseOrderId: "", truckRegistration: "", driverName: "",
  grossWeightKg: "", tareWeightKg: "", operatorName: "",
};

function WeighbridgeForm({ onCreated }: { onCreated: () => void }) {
  const [issuedPOs, setIssuedPOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<(PurchaseOrder & { lines?: unknown[] }) | null>(null);
  const [form, setForm] = useState<WeighbridgeFormState>(DEFAULTS);
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
    if (netWeight !== null && netWeight <= 0) { setError("Net weight must be positive (gross > tare)."); return; }

    setSubmitting(true);
    try {
      const wbRes = await procurementApi.weighbridge.create({
        purchaseOrderId: form.purchaseOrderId,
        truckRegistration: form.truckRegistration.trim(),
        driverName: form.driverName.trim() || undefined,
        grossWeightKg: Number(form.grossWeightKg),
        tareWeightKg: Number(form.tareWeightKg),
        operatorName: form.operatorName.trim() || undefined,
      });
      const ticketId = (wbRes.ticket as { id: string }).id;

      const po = selectedPO as (PurchaseOrder & {
        lines?: Array<{ id: string; quantity: number | string; unitPrice: number | string; quantityReceived: number | string }>;
      }) | null;
      const lines = (po?.lines ?? [])
        .map((l) => ({
          purchaseOrderLineId: l.id,
          quantityAccepted: Math.max(0, Number(l.quantity) - Number(l.quantityReceived)),
          unitPriceApplied: Number(l.unitPrice),
        }))
        .filter((l) => l.quantityAccepted > 0);

      if (lines.length === 0) {
        setError("No outstanding quantities on this PO.");
        setSubmitting(false);
        return;
      }

      await procurementApi.grns.create({
        purchaseOrderId: form.purchaseOrderId,
        weighbridgeTicketId: ticketId,
        receivedBy: form.operatorName.trim() || "WEIGHBRIDGE_OPERATOR",
        lines,
      });

      setSuccess(
        `Weighbridge ticket recorded. Net weight: ${fmtNum(netWeight, 3)} kg. GRN auto-created and sent to lab for QC.`
      );
      setForm(DEFAULTS);
      setSelectedPO(null);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white disabled:bg-slate-50 disabled:text-slate-400"
    />
  );

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
      {/* PO Selection */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Truck className="h-4 w-4 text-indigo-500" /> Purchase Order
        </h2>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Issued PO *</label>
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
        </div>
        {selectedPO && (
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 border border-slate-100">
            <p className="font-semibold text-slate-700">{(selectedPO as { supplier?: { name: string } }).supplier?.name}</p>
            <p className="text-slate-500">
              Expected:{" "}
              {(selectedPO as { expectedDelivery?: string }).expectedDelivery
                ? new Date((selectedPO as { expectedDelivery: string }).expectedDelivery).toLocaleDateString("en-KE")
                : "—"}
            </p>
          </div>
        )}
      </div>

      {/* Weight Measurements */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Scale className="h-4 w-4 text-indigo-500" /> Weight Measurements
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Truck Registration *</label>
            {inp({ value: form.truckRegistration, onChange: (e) => setForm((f) => ({ ...f, truckRegistration: e.target.value })), placeholder: "KAA 000A" })}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Driver Name</label>
            {inp({ value: form.driverName, onChange: (e) => setForm((f) => ({ ...f, driverName: e.target.value })), placeholder: "Optional" })}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gross Weight (kg) *</label>
            {inp({ type: "number", min: 0, step: "0.001", value: form.grossWeightKg, onChange: (e) => setForm((f) => ({ ...f, grossWeightKg: e.target.value })), placeholder: "e.g. 32000" })}
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tare Weight (kg) *</label>
            {inp({ type: "number", min: 0, step: "0.001", value: form.tareWeightKg, onChange: (e) => setForm((f) => ({ ...f, tareWeightKg: e.target.value })), placeholder: "e.g. 8000" })}
          </div>
        </div>
        {netWeight !== null && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-bold ${netWeight > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            <Scale className="h-4 w-4" />
            Net Weight: {fmtNum(netWeight, 3)} kg
          </div>
        )}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Weighbridge Operator</label>
          {inp({ value: form.operatorName, onChange: (e) => setForm((f) => ({ ...f, operatorName: e.target.value })), placeholder: "Optional" })}
        </div>
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
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
          Record & Create GRN
        </button>
      </div>
    </form>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

type Tab = "entry" | "history";

export function Weighbridge() {
  const [tab, setTab] = useState<Tab>("entry");
  const [tickets, setTickets] = useState<WeighbridgeTicket[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    procurementApi.weighbridge
      .list()
      .then((d) => setTickets(d.tickets as WeighbridgeTicket[]))
      .catch(() => setTickets([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Scale className="h-6 w-6 text-indigo-600" />
          Weighbridge Station
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Record truck weights for inbound deliveries · auto-creates GRN and sends to lab
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { id: "entry" as Tab, label: "New Entry", icon: Scale },
          { id: "history" as Tab, label: "Ticket History", icon: History },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "entry" && (
        <WeighbridgeForm onCreated={loadHistory} />
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-slate-200 rounded-xl">
              <Truck className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No inbound tickets yet</p>
              <p className="text-xs">Tickets will appear here after recording a delivery.</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-400 font-medium">
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} — most recent first
              </p>
              {tickets.map((t) => (
                <TicketHistoryRow key={t.id} ticket={t} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
