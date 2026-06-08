/**
 * Screen 3 — Others (Third-Party Services)
 *
 * Step 1: free-form customer + vehicle + service description, capture first
 *         weight (gross) on entry → Save Pending.
 * Step 2: capture second weight (tare) on exit AND collect payment
 *         (method + amount + reference) → Complete & Collect.
 *
 * Math: Net = firstWeight (gross) − secondWeight (tare)
 */
import React, { useState } from "react";
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Truck,
  User,
  Banknote,
  Hash,
  Wallet,
} from "lucide-react";
import { useLiveScale } from "../../modules/weighbridge/liveScale";
import { ScaleReadout } from "../../modules/weighbridge/components/ScaleReadout";
import {
  PendingQueue,
  ResumeBanner,
  cancelTicketApi,
} from "../../modules/weighbridge/components/PendingQueue";
import { WeighbridgeFooterActions } from "../../modules/weighbridge/components/WeighbridgeFooterActions";
import { NetWeightSummary } from "../../modules/weighbridge/components/NetWeightSummary";
import { weighbridgeApi } from "../../modules/weighbridge/api";
import type {
  PendingTicketSummary,
  WeighbridgePaymentMethod,
  WeighbridgeTicketRecord,
} from "../../modules/weighbridge/types";
import {
  calculateNetWeight,
  fmtKg,
} from "../../modules/weighbridge/format";

const SERVICE_OPTIONS = [
  "Public Weighing Fee",
  "Third-Party Truck Weighing",
  "Container Verification",
  "Customs / Port Inspection",
  "Internal QC Verification",
  "Other",
];

const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 bg-white disabled:bg-slate-50 disabled:text-slate-400 ${
      props.className ?? ""
    }`}
  />
);

export function WeighbridgeOthers() {
  // ── Form fields ─────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [serviceDescription, setServiceDescription] = useState(
    SERVICE_OPTIONS[0]
  );
  const [customService, setCustomService] = useState("");

  // ── Payment block (Step 2) ─────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] =
    useState<WeighbridgePaymentMethod>("CASH");
  const [amountCharged, setAmountCharged] = useState("");
  const [receiptReference, setReceiptReference] = useState("");

  // ── Step tracking ───────────────────────────────────────────────────────
  const [pendingTicket, setPendingTicket] = useState<WeighbridgeTicketRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Live scales ────────────────────────────────────────────────────────
  const firstScale = useLiveScale();
  const secondScale = useLiveScale();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setPendingTicket(null);
    setCustomerName("");
    setVehiclePlate("");
    setDriverName("");
    setServiceDescription(SERVICE_OPTIONS[0]);
    setCustomService("");
    setPaymentMethod("CASH");
    setAmountCharged("");
    setReceiptReference("");
    firstScale.reset();
    secondScale.reset();
    setError(null);
    setSuccess(null);
  };

  const handleResume = async (t: PendingTicketSummary) => {
    try {
      const res = await weighbridgeApi.tickets.get(t.id);
      setPendingTicket(res.data);
      firstScale.manuallySet(Number(res.data.firstWeightKg ?? 0));
      setCustomerName(res.data.customerName ?? "");
      setVehiclePlate(res.data.vehiclePlate ?? "");
      setDriverName(res.data.driverName ?? "");
      setServiceDescription(res.data.serviceDescription ?? SERVICE_OPTIONS[0]);
      if (res.data.paymentMethod)
        setPaymentMethod(res.data.paymentMethod as WeighbridgePaymentMethod);
      setAmountCharged(
        res.data.amountCharged != null ? String(res.data.amountCharged) : ""
      );
      setReceiptReference(res.data.receiptReference ?? "");
      setSuccess(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ticket");
    }
  };

  // ── Step 1: Save Pending ──────────────────────────────────────────────
  const handleSavePending = async () => {
    setError(null);
    setSuccess(null);
    if (!customerName.trim()) {
      setError("Customer / company name is required.");
      return;
    }
    if (!vehiclePlate.trim()) {
      setError("Vehicle plate number is required.");
      return;
    }
    if (!driverName.trim()) {
      setError("Driver name is required.");
      return;
    }
    const svc =
      serviceDescription === "Other" ? customService.trim() : serviceDescription;
    if (!svc) {
      setError("Service description is required.");
      return;
    }
    if (!pendingTicket && firstScale.capturedWeight == null) {
      setError("Capture the first weight (gross) before saving.");
      return;
    }
    setSubmitting(true);
    try {
      if (!pendingTicket) {
        const res = await weighbridgeApi.tickets.createOthers({
          customerName: customerName.trim(),
          vehiclePlate: vehiclePlate.trim(),
          driverName: driverName.trim(),
          serviceDescription: svc,
          firstWeightKg: Number(firstScale.capturedWeight),
          isManual: false,
        });
        setPendingTicket(res.data);
        setSuccess(
          `Pending ticket ${res.data.ticketNumber} created. Capture tare weight on exit, then collect payment.`
        );
      } else {
        setSuccess("Pending ticket is up to date.");
      }
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save pending ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 2: Complete & Collect ────────────────────────────────────────
  const handleComplete = async () => {
    setError(null);
    if (!pendingTicket) {
      setError("No pending ticket to complete. Save first.");
      return;
    }
    if (secondScale.capturedWeight == null) {
      setError("Capture the second weight (tare) before completing.");
      return;
    }
    const amt = Number(amountCharged);
    if (!amt || isNaN(amt) || amt < 0) {
      setError("Amount charged must be a non-negative number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await weighbridgeApi.tickets.completeOthers(
        pendingTicket.id,
        {
          secondWeightKg: Number(secondScale.capturedWeight),
          paymentMethod,
          amountCharged: amt,
          receiptReference: receiptReference.trim() || undefined,
          isManual: false,
        }
      );
      setSuccess(
        `Ticket ${res.data.ticketNumber} completed. Net ${fmtKg(
          res.data.netWeightKg
        )} · ${paymentMethod} ${amt.toLocaleString()} collected.`
      );
      setRefreshKey((k) => k + 1);
      setTimeout(resetForm, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!pendingTicket) {
      resetForm();
      return;
    }
    const reason = window.prompt(
      "Reason for cancelling this ticket?",
      "Operator error"
    );
    if (!reason || !reason.trim()) return;
    try {
      await cancelTicketApi(pendingTicket.id, reason.trim());
      setSuccess("Ticket cancelled.");
      setRefreshKey((k) => k + 1);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel ticket.");
    }
  };

  // ── Computed weights ────────────────────────────────────────────────────
  const first = pendingTicket
    ? Number(pendingTicket.firstWeightKg ?? 0)
    : firstScale.capturedWeight;
  const second = secondScale.capturedWeight;
  const net = calculateNetWeight("OTHERS", first, second);
  const isResuming = !!pendingTicket;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Wrench className="h-6 w-6 text-amber-600" />
          Others · Third-Party Services
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Public weighing fees · Net = Gross − Tare
        </p>
      </div>

      {isResuming && pendingTicket && (
        <ResumeBanner ticket={pendingTicket} onClear={resetForm} />
      )}

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-3 rounded-lg">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header — Customer & vehicle */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <User className="h-4 w-4 text-amber-500" /> Customer & Vehicle
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Customer / Company Name <span className="text-rose-500">*</span>
                </label>
                {inp({
                  value: customerName,
                  onChange: (e) => setCustomerName(e.target.value),
                  placeholder: "Walk-in customer or company",
                })}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Vehicle Plate Number <span className="text-rose-500">*</span>
                </label>
                {inp({
                  value: vehiclePlate,
                  onChange: (e) =>
                    setVehiclePlate(e.target.value.toUpperCase()),
                  placeholder: "KAA 000A",
                })}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Driver Name <span className="text-rose-500">*</span>
                </label>
                {inp({
                  value: driverName,
                  onChange: (e) => setDriverName(e.target.value),
                  placeholder: "Driver full name",
                })}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Service Description <span className="text-rose-500">*</span>
                </label>
                <select
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                  aria-label="Service description"
                >
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {serviceDescription === "Other" && (
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Custom service description
                  </label>
                  {inp({
                    value: customService,
                    onChange: (e) => setCustomService(e.target.value),
                    placeholder: "e.g. Special import inspection",
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Scales row */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <ScaleReadout
                scale={firstScale}
                label="First Weight (Gross) — Inbound"
                accent="amber"
                active={!isResuming}
                onCapture={() => firstScale.capture()}
              />
              {isResuming && (
                <p className="mt-2 text-[10px] text-amber-700 italic">
                  First weight already captured.
                </p>
              )}
            </div>
            <div>
              <ScaleReadout
                scale={secondScale}
                label="Second Weight (Tare) — Outbound"
                accent="amber"
                active={isResuming}
                onCapture={() => secondScale.capture()}
              />
              {!isResuming && (
                <p className="mt-2 text-[10px] text-slate-400 italic">
                  Available after Step 1 (Save Pending).
                </p>
              )}
            </div>
          </section>

          {/* Net weight summary */}
          <NetWeightSummary
            label="Net Weight (Calculated)"
            net={net}
            firstLabel="Gross"
            first={first}
            secondLabel="Tare"
            second={second}
            accent="amber"
          />

          {/* Payment collection block — visible on Step 2 */}
          {isResuming && (
            <section className="bg-amber-50/40 border border-amber-200 rounded-xl p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Payment Collection (Step 2)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Payment Method <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as WeighbridgePaymentMethod)
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                    aria-label="Payment method"
                  >
                    <option value="CASH">Cash</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="ON_ACCOUNT">On Account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Amount Charged (KES) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Banknote className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    {inp({
                      type: "number",
                      min: 0,
                      step: "0.01",
                      value: amountCharged,
                      onChange: (e) => setAmountCharged(e.target.value),
                      placeholder: "0.00",
                      className: "pl-7",
                      style: { paddingLeft: 28 },
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Receipt / Reference #
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    {inp({
                      value: receiptReference,
                      onChange: (e) => setReceiptReference(e.target.value),
                      placeholder: "M-Pesa code, cheque no…",
                      className: "pl-7",
                      style: { paddingLeft: 28 },
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Footer actions */}
          <WeighbridgeFooterActions
            isResuming={isResuming}
            hasFirstWeight={firstScale.capturedWeight != null}
            hasSecondWeight={secondScale.capturedWeight != null}
            submitting={submitting}
            step1Label="Save Pending (Step 1)"
            step2Label="Complete & Collect (Step 2)"
            onReset={resetForm}
            onCancel={handleCancel}
            onSavePending={handleSavePending}
            onComplete={handleComplete}
          />
        </div>

        {/* ─── RIGHT: pending queue ─────────────────────────────────── */}
        <div className="space-y-4">
          <PendingQueue
            type="OTHERS"
            onResume={handleResume}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
