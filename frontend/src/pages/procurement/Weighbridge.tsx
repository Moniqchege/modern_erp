import React, { useEffect, useState } from "react";
import { Loader2, Truck, Scale, CheckCircle2, AlertTriangle } from "lucide-react";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type { PurchaseOrder } from "../../modules/procurement/types/procurement";

const fmtNum = (v?: number | string | null, dp = 2) =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

interface WeighbridgeFormState {
  purchaseOrderId: string;
  truckRegistration: string;
  driverName: string;
  grossWeightKg: string;
  tareWeightKg: string;
  operatorName: string;
  notes: string;
}

const DEFAULTS: WeighbridgeFormState = {
  purchaseOrderId: "",
  truckRegistration: "",
  driverName: "",
  grossWeightKg: "",
  tareWeightKg: "",
  operatorName: "",
  notes: "",
};

export function Weighbridge() {
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

      // 2. Auto-create GRN draft with weighbridge ticket
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

      await procurementApi.grns.create({
        purchaseOrderId: form.purchaseOrderId,
        weighbridgeTicketId: ticketId,
        receivedBy: form.operatorName.trim() || "WEIGHBRIDGE_OPERATOR",
        lines,
      });

      setSuccess(`Weighbridge ticket recorded. Net weight: ${fmtNum(netWeight, 3)} kg. GRN auto-created and sent to lab for QC.`);
      setForm(DEFAULTS);
      setSelectedPO(null);
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
                Expected: {(selectedPO as { expectedDelivery?: string }).expectedDelivery
                  ? new Date((selectedPO as { expectedDelivery: string }).expectedDelivery).toLocaleDateString("en-KE")
                  : "—"}
              </p>
            </div>
          )}
        </div>

        {/* Weighbridge Data */}
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
    </div>
  );
}
