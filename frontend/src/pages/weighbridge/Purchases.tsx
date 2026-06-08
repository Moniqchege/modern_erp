/**
 * Screen 1 — Purchases (Maize Inflow)
 *
 * Step 1: enter PO, plate, driver, capture first weight (gross) → Save Pending
 * Step 2: capture second weight (tare) on the way out → Complete Ticket
 *
 * Math: Net = firstWeight (gross) − secondWeight (tare)
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  FileText,
  Truck,
  CheckCircle2,
  AlertTriangle,
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
import {
  toPurchaseOrderLookup,
  weighbridgeApi,
} from "../../modules/weighbridge/api";
import type {
  PendingTicketSummary,
  PurchaseOrderLookup,
  WeighbridgeTicketRecord,
} from "../../modules/weighbridge/types";
import {
  calculateNetWeight,
  fmtKg,
  fmtNum,
} from "../../modules/weighbridge/format";

const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 bg-white disabled:bg-slate-50 disabled:text-slate-400 ${
      props.className ?? ""
    }`}
  />
);

export function WeighbridgePurchases() {
  // ── Header selection ────────────────────────────────────────────────────
  const [poList, setPoList] = useState<PurchaseOrderLookup[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(true);
  const [selectedPOId, setSelectedPOId] = useState("");
  const selectedPO = useMemo(
    () => poList.find((p) => p.id === selectedPOId) ?? null,
    [poList, selectedPOId]
  );

  // ── Form fields ─────────────────────────────────────────────────────────
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [supplierDriverName, setSupplierDriverName] = useState("");

  // ── Step tracking ───────────────────────────────────────────────────────
  const [pendingTicket, setPendingTicket] = useState<WeighbridgeTicketRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Live scales (one for first, one for second) ────────────────────────
  const firstScale = useLiveScale();
  const secondScale = useLiveScale();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Load POs on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoadingPOs(true);
    weighbridgeApi.purchaseOrders
      .list()
      .then((res) => {
        if (!alive) return;
        const list = (res.purchaseOrders ?? [])
          .map(toPurchaseOrderLookup)
          .filter((p: PurchaseOrderLookup) =>
            ["ISSUED", "PARTIALLY_RECEIVED", "APPROVED"].includes(p.status)
          );
        setPoList(list);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load POs");
      })
      .finally(() => {
        if (alive) setLoadingPOs(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const resetForm = () => {
    setPendingTicket(null);
    setVehiclePlate("");
    setDriverName("");
    setSupplierDriverName("");
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
      setVehiclePlate(res.data.vehiclePlate ?? "");
      setDriverName(res.data.driverName ?? "");
      setSupplierDriverName(res.data.supplierDriverName ?? "");
      if (res.data.purchaseOrderId) setSelectedPOId(res.data.purchaseOrderId);
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
    if (!selectedPO && !pendingTicket) {
      setError("Please select a Purchase Order.");
      return;
    }
    if (!vehiclePlate.trim()) {
      setError("Truck plate number is required.");
      return;
    }
    if (!driverName.trim()) {
      setError("Driver name is required.");
      return;
    }
    if (!pendingTicket && firstScale.capturedWeight == null) {
      setError("Capture the first weight (gross) before saving.");
      return;
    }
    setSubmitting(true);
    try {
      if (!pendingTicket) {
        const res = await weighbridgeApi.tickets.createPurchase({
          purchaseOrderId: selectedPO?.id,
          supplierName: selectedPO?.supplier?.name ?? "—",
          supplierDriverName: supplierDriverName.trim() || undefined,
          vehiclePlate: vehiclePlate.trim(),
          driverName: driverName.trim(),
          firstWeightKg: Number(firstScale.capturedWeight),
          isManual: false,
        });
        setPendingTicket(res.data);
        setSuccess(
          `Pending ticket ${res.data.ticketNumber} created. Capture tare weight on exit.`
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

  // ── Step 2: Complete Ticket ───────────────────────────────────────────
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
    setSubmitting(true);
    try {
      const res = await weighbridgeApi.tickets.captureSecondWeight(
        pendingTicket.id,
        { secondWeightKg: Number(secondScale.capturedWeight), isManual: false }
      );
      setSuccess(
        `Ticket ${res.data.ticketNumber} completed. Net weight: ${fmtKg(
          res.data.netWeightKg
        )}.`
      );
      setRefreshKey((k) => k + 1);
      setTimeout(resetForm, 1500);
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
  const net = calculateNetWeight("PURCHASE", first, second);
  const isResuming = !!pendingTicket;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-emerald-600" />
          Purchases · Maize Inflow
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Inbound deliveries · Net = Gross − Tare
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
          {/* Header — PO selection */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" /> Purchase Order
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  PO Number
                </label>
                <select
                  value={selectedPOId}
                  onChange={(e) => setSelectedPOId(e.target.value)}
                  disabled={isResuming}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  aria-label="Select purchase order"
                >
                  <option value="">
                    {loadingPOs ? "Loading POs…" : "— choose a PO —"}
                  </option>
                  {poList.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber} · {po.supplier?.name ?? "Unknown"} ·{" "}
                      {po.currency} {fmtNum(po.totalAmount, 0)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Supplier Name
                </label>
                {inp({
                  value: selectedPO?.supplier?.name ?? "",
                  readOnly: true,
                  placeholder: "Auto-filled from PO",
                })}
              </div>
            </div>
            {selectedPO && (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg px-3 py-2 text-[11px] text-emerald-800">
                Ordered quantity (from PO lines):{" "}
                <strong>
                  {selectedPO.orderedQtyKg
                    ? fmtKg(selectedPO.orderedQtyKg)
                    : `${selectedPO.currency} ${fmtNum(selectedPO.totalAmount, 0)}`}
                </strong>
                <span className="ml-2 text-emerald-600">
                  · Status: {selectedPO.status}
                </span>
              </div>
            )}
          </section>

          {/* Form fields — truck & driver */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-500" /> Vehicle & Driver
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Truck Plate Number <span className="text-rose-500">*</span>
                </label>
                {inp({
                  value: vehiclePlate,
                  onChange: (e) =>
                    setVehiclePlate(e.target.value.toUpperCase()),
                  placeholder: "KAA 000A",
                  disabled: isResuming,
                })}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Driver Name <span className="text-rose-500">*</span>
                </label>
                {inp({
                  value: driverName,
                  onChange: (e) => setDriverName(e.target.value),
                  placeholder: "External supplier driver",
                })}
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Supplier Driver (optional)
                </label>
                {inp({
                  value: supplierDriverName,
                  onChange: (e) => setSupplierDriverName(e.target.value),
                  placeholder: "If different from the actual driver",
                })}
              </div>
            </div>
          </section>

          {/* Scales row */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <ScaleReadout
                scale={firstScale}
                label="First Weight (Gross) — Inbound"
                accent="emerald"
                active={!isResuming}
                onCapture={() => firstScale.capture()}
              />
              {isResuming && (
                <p className="mt-2 text-[10px] text-amber-700 italic">
                  First weight already captured for this ticket.
                </p>
              )}
            </div>
            <div>
              <ScaleReadout
                scale={secondScale}
                label="Second Weight (Tare) — Outbound"
                accent="emerald"
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
            accent="emerald"
          />

          {/* Footer actions */}
          <WeighbridgeFooterActions
            isResuming={isResuming}
            hasFirstWeight={firstScale.capturedWeight != null}
            hasSecondWeight={secondScale.capturedWeight != null}
            submitting={submitting}
            step1Label="Save Pending (Step 1)"
            step2Label="Complete Ticket (Step 2)"
            onReset={resetForm}
            onCancel={handleCancel}
            onSavePending={handleSavePending}
            onComplete={handleComplete}
          />
        </div>

        {/* ─── RIGHT: pending queue ─────────────────────────────────── */}
        <div className="space-y-4">
          <PendingQueue
            type="PURCHASE"
            onResume={handleResume}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
