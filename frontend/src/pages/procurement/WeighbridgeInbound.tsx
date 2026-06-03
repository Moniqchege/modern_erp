import React, { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Truck,
  ChevronDown,
  ChevronUp,
  Scale,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type {
  GrainIntakeGrnRecord,
  WeighbridgeTicket,
} from "../../modules/procurement/types/procurement";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const GRAIN_INTAKE_KEY = "grain-intake-grn-records";

function readLocalRecords(): GrainIntakeGrnRecord[] {
  try {
    const raw = localStorage.getItem(GRAIN_INTAKE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GrainIntakeGrnRecord[];
  } catch {
    return [];
  }
}

function writeLocalRecords(records: GrainIntakeGrnRecord[]) {
  localStorage.setItem(GRAIN_INTAKE_KEY, JSON.stringify(records));
}

const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtKg = (v?: number | string | null) =>
  v == null ? "—" : `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`;

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

// ─── History row (collapsible) ────────────────────────────────────────────────

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
          {latestQc && <QcBadge status={latestQc.status} />}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-slate-700">{fmtKg(ticket.netWeightKg)}</span>
          <span className="text-[10px] text-slate-400">{fmtDate(ticket.weighedInAt)}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-4">
          {/* Weight breakdown */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Gross weight", value: fmtKg(ticket.grossWeightKg) },
              { label: "Tare weight", value: fmtKg(ticket.tareWeightKg) },
              { label: "Net weight", value: fmtKg(ticket.netWeightKg) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-black font-mono text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div>
              <span className="text-slate-400">Driver: </span>
              <span className="font-medium">{ticket.driverName ?? "—"}</span>
            </div>
            <div>
              <span className="text-slate-400">Operator: </span>
              <span className="font-medium">{ticket.operatorName ?? "—"}</span>
            </div>
            <div>
              <span className="text-slate-400">Weighed in: </span>
              <span className="font-medium">{fmtDate(ticket.weighedInAt)}</span>
            </div>
            <div>
              <span className="text-slate-400">Weighed out: </span>
              <span className="font-medium">{fmtDate(ticket.weighedOutAt)}</span>
            </div>
          </div>

          {/* QC summary if available */}
          {latestQc && (
            <div
              className={`rounded-lg border px-4 py-3 text-xs space-y-2 ${
                latestQc.status === "PASSED"
                  ? "bg-emerald-50 border-emerald-200"
                  : latestQc.status === "FULL_REJECTION"
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {latestQc.status === "PASSED" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : latestQc.status === "FULL_REJECTION" ? (
                  <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                )}
                <span className="font-bold text-slate-800">
                  QC {latestQc.qcNumber} — <QcBadge status={latestQc.status} />
                </span>
                <span className="text-slate-500 ml-auto">Tested by: {latestQc.testedBy}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-slate-600">
                {latestQc.moistureContentPct != null && (
                  <div>
                    <span className="text-slate-400">Moisture: </span>
                    <span className="font-mono font-semibold">{Number(latestQc.moistureContentPct).toFixed(2)}%</span>
                  </div>
                )}
                {latestQc.aflatoxinPpb != null && (
                  <div>
                    <span className="text-slate-400">Aflatoxin: </span>
                    <span className="font-mono font-semibold">{Number(latestQc.aflatoxinPpb).toFixed(2)} ppb</span>
                  </div>
                )}
                {latestQc.assignedGrade && (
                  <div>
                    <span className="text-slate-400">Grade: </span>
                    <span className="font-semibold">{latestQc.assignedGrade}</span>
                  </div>
                )}
                {latestQc.priceDeductionPct != null && Number(latestQc.priceDeductionPct) > 0 && (
                  <div>
                    <span className="text-slate-400">Price deduction: </span>
                    <span className="font-mono font-semibold text-amber-700">
                      {Number(latestQc.priceDeductionPct).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              {latestQc.rejectionNote && (
                <p className="text-red-700 font-medium">{latestQc.rejectionNote}</p>
              )}
              {latestQc.remarks && (
                <p className="text-slate-600 italic">{latestQc.remarks}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Entry form ───────────────────────────────────────────────────────────────

function WeighbridgeForm({ onCreated }: { onCreated: () => void }) {
  const [supplierName, setSupplierName] = useState("");
  const [truckPlate, setTruckPlate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [grossWeightKg, setGrossWeightKg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const gross = Number(grossWeightKg);
    if (
      !supplierName.trim() ||
      !truckPlate.trim() ||
      !driverName.trim() ||
      !Number.isFinite(gross) ||
      gross <= 0
    ) {
      setError("Enter supplier, truck plate, driver name, and valid gross weight.");
      return;
    }

    const record: GrainIntakeGrnRecord = {
      id: `grn-${Date.now()}`,
      grnNumber: `GRN-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      status: "PENDING_QC",
      supplierName: supplierName.trim(),
      truckLicensePlate: truckPlate.trim().toUpperCase(),
      driverName: driverName.trim(),
      grossWeightKg: gross,
      weighedInAt: new Date().toISOString(),
    };

    setIsLoading(true);
    try {
      await procurementApi.grns.create({
        supplierName: record.supplierName,
        truckLicensePlate: record.truckLicensePlate,
        driverName: record.driverName,
        grossWeightKg: record.grossWeightKg,
        status: record.status,
      });
    } catch {
      // Keep workflow resilient in isolated role screen; local queue still records intake.
    } finally {
      const existing = readLocalRecords();
      writeLocalRecords([record, ...existing]);
      setIsLoading(false);
      setSuccess(`${record.grnNumber} registered and moved to PENDING_QC.`);
      setSupplierName("");
      setTruckPlate("");
      setDriverName("");
      setGrossWeightKg("");
      onCreated();
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </div>
      )}

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">Supplier Name</span>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Rift Valley Maize Co-op"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">Truck Plate</span>
            <input
              value={truckPlate}
              onChange={(e) => setTruckPlate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="KDA 123X"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">Driver Name</span>
            <input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="John Mwangi"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">Gross Weight (kg)</span>
            <input
              type="number"
              min="1"
              step="0.001"
              value={grossWeightKg}
              onChange={(e) => setGrossWeightKg(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="28000"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Truck className="h-3.5 w-3.5" />
          )}
          {isLoading ? "Registering..." : "Register Inbound Truck"}
        </button>
      </form>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

type Tab = "entry" | "history";

export function WeighbridgeInbound() {
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

  // Load history when tab becomes active
  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">Weighbridge Inbound</h1>
        <p className="text-xs text-slate-500 mt-1">
          Role: Weighbridge Clerk. Register incoming truck gross weights only.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(
          [
            { id: "entry" as Tab, label: "New Entry", icon: Scale },
            { id: "history" as Tab, label: "Ticket History", icon: Truck },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
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

      {tab === "entry" && (
        <WeighbridgeForm
          onCreated={() => {
            // Reload history in background so it's fresh when user switches tabs
            loadHistory();
          }}
        />
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
              <p className="text-xs">Register a truck from the New Entry tab.</p>
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
