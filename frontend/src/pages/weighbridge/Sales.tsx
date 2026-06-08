/**
 * Screen 2 — Sales (Flour Outflow)
 *
 * Step 1: enter SO, choose company truck (auto-fills driver), capture
 *         first weight (TARE) on entry → Save Pending.
 *         Triggers a Tare Variance check immediately on capture.
 * Step 2: capture second weight (GROSS) on exit → Complete Ticket.
 *
 * Math: Net = secondWeight (gross) − firstWeight (tare)
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Truck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
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
  toSalesOrderLookup,
  weighbridgeApi,
} from "../../modules/weighbridge/api";
import type {
  PendingTicketSummary,
  SalesOrderLookup,
  TruckMasterRecord,
  WeighbridgeTicketRecord,
} from "../../modules/weighbridge/types";
import {
  calculateNetWeight,
  fmtKg,
  fmtNum,
} from "../../modules/weighbridge/format";

const TARE_VARIANCE_THRESHOLD = 50; // matches backend service

const inp = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white disabled:bg-slate-50 disabled:text-slate-400 ${
      props.className ?? ""
    }`}
  />
);

export function WeighbridgeSales() {
  // ── Header selection ────────────────────────────────────────────────────
  const [soList, setSoList] = useState<SalesOrderLookup[]>([]);
  const [loadingSOs, setLoadingSOs] = useState(true);
  const [selectedSOId, setSelectedSOId] = useState("");
  const selectedSO = useMemo(
    () => soList.find((s) => s.id === selectedSOId) ?? null,
    [soList, selectedSOId]
  );

  // ── Truck master (HR-linked driver) ────────────────────────────────────
  const [trucks, setTrucks] = useState<TruckMasterRecord[]>([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const selectedTruck = useMemo(
    () => trucks.find((t) => t.id === selectedTruckId) ?? null,
    [trucks, selectedTruckId]
  );

  // ── Step tracking ───────────────────────────────────────────────────────
  const [pendingTicket, setPendingTicket] = useState<WeighbridgeTicketRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Live scales (first = TARE on entry, second = GROSS on exit) ───────
  const firstScale = useLiveScale();
  const secondScale = useLiveScale();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Tare variance feedback (live as operator captures) ────────────────
  const [tareVariance, setTareVariance] = useState<{
    variance: number;
    flagged: boolean;
  } | null>(null);

  // ── Load SOs + trucks on mount ─────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoadingSOs(true);
    weighbridgeApi.salesOrders
      .list()
      .then((res) => {
        if (!alive) return;
        const list = (res.salesOrders ?? [])
          .map(toSalesOrderLookup)
          .filter((s: SalesOrderLookup) =>
            ["APPROVED", "CONFIRMED", "IN_PROGRESS", "PARTIALLY_DISPATCHED"].includes(
              s.status
            )
          );
        setSoList(list);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load SOs");
      })
      .finally(() => {
        if (alive) setLoadingSOs(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoadingTrucks(true);
    weighbridgeApi.trucks
      .list()
      .then((res) => {
        if (!alive) return;
        setTrucks(res.data ?? []);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load trucks");
      })
      .finally(() => {
        if (alive) setLoadingTrucks(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Recompute tare variance whenever first weight or truck changes
  useEffect(() => {
    if (firstScale.capturedWeight == null || !selectedTruck) {
      setTareVariance(null);
      return;
    }
    const v = Math.abs(firstScale.capturedWeight - selectedTruck.masterTareKg);
    setTareVariance({ variance: v, flagged: v > TARE_VARIANCE_THRESHOLD });
  }, [firstScale.capturedWeight, selectedTruck]);

  const resetForm = () => {
    setPendingTicket(null);
    setTareVariance(null);
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
      if (res.data.salesOrderId) setSelectedSOId(res.data.salesOrderId);
      if (res.data.truckMasterId) setSelectedTruckId(res.data.truckMasterId);
      // Show pre-computed variance from backend (already snapshot at create)
      if (res.data.tareVarianceKg != null) {
        setTareVariance({
          variance: Number(res.data.tareVarianceKg),
          flagged: !!res.data.varianceFlagged,
        });
      }
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
    if (!selectedSO && !pendingTicket) {
      setError("Please select a Sales Order.");
      return;
    }
    if (!selectedTruck && !pendingTicket) {
      setError("Please select a company truck.");
      return;
    }
    if (!pendingTicket && firstScale.capturedWeight == null) {
      setError("Capture the first weight (tare) before saving.");
      return;
    }
    setSubmitting(true);
    try {
      if (!pendingTicket) {
        const res = await weighbridgeApi.tickets.createSale({
          salesOrderId: selectedSO?.id,
          customerName: selectedSO?.customer?.name ?? "—",
          truckMasterId: selectedTruck!.id,
          firstWeightKg: Number(firstScale.capturedWeight),
          isManual: false,
        });
        setPendingTicket(res.data);
        setSuccess(
          `Pending ticket ${res.data.ticketNumber} created. Capture gross weight on exit.`
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
      setError("Capture the second weight (gross) before completing.");
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
  const net = calculateNetWeight("SALE", first, second);
  const isResuming = !!pendingTicket;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Truck className="h-6 w-6 text-indigo-600" />
          Sales · Flour Outflow
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Outbound dispatches · Net = Gross − Tare
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
          {/* Header — SO + Truck */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" /> Sales Order &
              Truck
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Sales Order (SO) Number
                </label>
                <select
                  value={selectedSOId}
                  onChange={(e) => setSelectedSOId(e.target.value)}
                  disabled={isResuming}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  aria-label="Select sales order"
                >
                  <option value="">
                    {loadingSOs ? "Loading SOs…" : "— choose a SO —"}
                  </option>
                  {soList.map((so) => (
                    <option key={so.id} value={so.id}>
                      {so.orderNumber} · {so.customer?.name ?? "Unknown"} ·{" "}
                      {so.currency} {fmtNum(so.totalAmount, 0)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Customer Name
                </label>
                {inp({
                  value: selectedSO?.customer?.name ?? "",
                  readOnly: true,
                  placeholder: "Auto-filled from SO",
                })}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Company Truck
                </label>
                <select
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
                  disabled={isResuming}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  aria-label="Select company truck"
                >
                  <option value="">
                    {loadingTrucks ? "Loading trucks…" : "— choose a truck —"}
                  </option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.licensePlate} · {t.model}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Assigned Driver (from HR)
                </label>
                {inp({
                  value: selectedTruck?.activeDriver ?? "",
                  readOnly: true,
                  placeholder: "Linked to truck",
                })}
              </div>
            </div>

            {selectedTruck && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg px-3 py-2 text-[11px] text-indigo-800">
                Master tare weight:{" "}
                <strong>{fmtKg(selectedTruck.masterTareKg)}</strong>
                <span className="ml-2 text-indigo-600">
                  · Variance threshold: ±{TARE_VARIANCE_THRESHOLD} kg
                </span>
              </div>
            )}
          </section>

          {/* Scales row */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <ScaleReadout
                scale={firstScale}
                label="First Weight (Tare) — Inbound"
                accent="indigo"
                active={!isResuming}
                onCapture={() => firstScale.capture()}
              />
              {isResuming && (
                <p className="mt-2 text-[10px] text-amber-700 italic">
                  First weight already captured for this ticket.
                </p>
              )}
              {/* Tare variance check banner — fires immediately on capture */}
              {tareVariance && (
                <div
                  className={`mt-3 flex items-start gap-2 rounded-xl border px-4 py-3 text-[11px] ${
                    tareVariance.flagged
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}
                >
                  {tareVariance.flagged ? (
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-extrabold">
                      {tareVariance.flagged
                        ? "Tare variance flagged"
                        : "Tare variance within tolerance"}
                    </p>
                    <p>
                      Captured {fmtKg(firstScale.capturedWeight ?? undefined)}
                      {" "}vs master tare {fmtKg(selectedTruck?.masterTareKg)}.
                      {" "}Δ = <strong>{fmtKg(tareVariance.variance)}</strong>
                      {tareVariance.flagged && (
                        <span className="ml-1">
                          (above ±{TARE_VARIANCE_THRESHOLD} kg limit — verify
                          before completing)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div>
              <ScaleReadout
                scale={secondScale}
                label="Second Weight (Gross) — Outbound"
                accent="indigo"
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
            firstLabel="Tare"
            first={first}
            secondLabel="Gross"
            second={second}
            accent="indigo"
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
            type="SALE"
            onResume={handleResume}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
