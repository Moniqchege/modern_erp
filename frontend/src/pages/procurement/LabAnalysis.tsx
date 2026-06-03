import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
} from "lucide-react";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type {
  GrainIntakeGrnRecord,
  LabQCResult,
} from "../../modules/procurement/types/procurement";

// ─── Shared constants & helpers ───────────────────────────────────────────────

const GRAIN_INTAKE_KEY = "grain-intake-grn-records";
const MAX_MOISTURE = 13.5;
const MAX_AFLATOXIN = 10;

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

// ─── Status badge ─────────────────────────────────────────────────────────────

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

// ─── History row (collapsible) ────────────────────────────────────────────────

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
          <span className="font-mono font-bold text-slate-900 text-sm">{result.qcNumber}</span>
          {result.weighbridgeTicket?.truckRegistration && (
            <span className="text-xs text-slate-600 font-medium">
              {result.weighbridgeTicket.truckRegistration}
            </span>
          )}
          {result.grn?.purchaseOrder?.supplier?.name && (
            <span className="text-xs text-slate-500">
              {result.grn.purchaseOrder.supplier.name}
            </span>
          )}
          {result.grn?.grnNumber && (
            <span className="text-xs font-mono text-slate-400">{result.grn.grnNumber}</span>
          )}
          <QcBadge status={result.status} />
          {result.assignedGrade && (
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              {result.assignedGrade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-slate-400">By: {result.testedBy}</span>
          <span className="text-[10px] text-slate-400">{fmtDate(result.testedAt)}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-5 space-y-4">
          {/* Safety readings */}
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
                suffix: "%",
              },
              {
                label: "Aflatoxin",
                value:
                  result.aflatoxinPpb != null
                    ? `${Number(result.aflatoxinPpb).toFixed(2)} ppb`
                    : "—",
                limit: MAX_AFLATOXIN,
                raw: result.aflatoxinPpb,
                suffix: " ppb",
              },
              {
                label: "Rotten/Broken",
                value:
                  result.rottenBrokenPct != null
                    ? `${Number(result.rottenBrokenPct).toFixed(2)}%`
                    : "—",
                limit: null,
                raw: null,
                suffix: "",
              },
              {
                label: "Foreign matter",
                value:
                  result.foreignMatterPct != null
                    ? `${Number(result.foreignMatterPct).toFixed(2)}%`
                    : "—",
                limit: null,
                raw: null,
                suffix: "",
              },
            ].map(({ label, value, limit, raw }) => {
              const exceeded = limit != null && raw != null && Number(raw) > limit;
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

          {/* Additional details */}
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
            {result.priceDeductionPct != null && Number(result.priceDeductionPct) > 0 && (
              <div>
                <span className="text-slate-400">Price deduction: </span>
                <span className="font-mono font-semibold text-amber-700">
                  {Number(result.priceDeductionPct).toFixed(1)}%
                </span>
              </div>
            )}
            {result.weighbridgeTicket?.ticketNumber && (
              <div>
                <span className="text-slate-400">Weighbridge ticket: </span>
                <span className="font-mono font-medium">
                  {result.weighbridgeTicket.ticketNumber}
                </span>
              </div>
            )}
          </div>

          {/* Rejection note */}
          {result.rejectionNote && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {result.rejectionNote}
            </div>
          )}

          {/* Remarks */}
          {result.remarks && (
            <p className="text-xs text-slate-500 italic">{result.remarks}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── QC entry form ────────────────────────────────────────────────────────────

function LabForm({ onCreated }: { onCreated: () => void }) {
  const [records, setRecords] = useState<GrainIntakeGrnRecord[]>(() =>
    readLocalRecords()
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const [technicianUserId, setTechnicianUserId] = useState("");
  const [moistureContentPct, setMoistureContentPct] = useState("");
  const [aflatoxinPpb, setAflatoxinPpb] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const pendingQc = useMemo(
    () => records.filter((r) => r.status === "PENDING_QC"),
    [records]
  );
  const selected = useMemo(
    () => pendingQc.find((r) => r.id === selectedId) ?? null,
    [pendingQc, selectedId]
  );

  const moisture = Number(moistureContentPct);
  const aflatoxin = Number(aflatoxinPpb);
  const exceedsSafetyLimit =
    (Number.isFinite(moisture) && moisture > MAX_MOISTURE) ||
    (Number.isFinite(aflatoxin) && aflatoxin > MAX_AFLATOXIN);

  const actionLabel = exceedsSafetyLimit
    ? "Issue Rejection Certificate"
    : "Approve for Unloading";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selected) {
      setError("Select a pending truck first.");
      return;
    }
    if (!technicianUserId.trim()) {
      setError("Technician user ID is required.");
      return;
    }
    if (
      !Number.isFinite(moisture) ||
      moisture < 0 ||
      !Number.isFinite(aflatoxin) ||
      aflatoxin < 0
    ) {
      setError("Enter valid moisture and aflatoxin values.");
      return;
    }

    setIsLoading(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 700));

    const nextStatus =
      exceedsSafetyLimit ? ("REJECTED" as const) : ("READY_TO_UNLOAD" as const);
    const rejectionReason = exceedsSafetyLimit
      ? `Auto-rejected by food safety rule (moisture>${MAX_MOISTURE}% or aflatoxin>${MAX_AFLATOXIN}ppb).`
      : undefined;

    const updated: GrainIntakeGrnRecord[] = records.map((record) =>
      record.id === selected.id
        ? {
            ...record,
            technicianUserId: technicianUserId.trim(),
            moistureContentPct: moisture,
            aflatoxinPpb: aflatoxin,
            status: nextStatus,
            rejectionReason,
          }
        : record
    );
    writeLocalRecords(updated);
    setRecords(updated);
    setIsLoading(false);
    setSuccess(
      nextStatus === "REJECTED"
        ? "Rejected automatically by mandatory food safety limits."
        : "QC passed. Truck is READY_TO_UNLOAD."
    );
    setSelectedId("");
    setMoistureContentPct("");
    setAflatoxinPpb("");
    onCreated();
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

      {/* Pending queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800">Pending QC Queue</h2>
        {pendingQc.length === 0 ? (
          <p className="text-xs text-slate-500">No trucks pending QC analysis.</p>
        ) : (
          <div className="space-y-2">
            {pendingQc.map((row) => (
              <button
                type="button"
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={`w-full text-left border rounded-lg px-3 py-2 text-xs transition ${
                  selectedId === row.id
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="font-semibold">{row.grnNumber}</span> •{" "}
                {row.truckLicensePlate} • {row.supplierName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Analysis form */}
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <h2 className="text-sm font-bold text-slate-800">QC Analysis Form</h2>
        {!selected ? (
          <p className="text-xs text-slate-500">
            Select a pending truck to begin analysis.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">
                  Technician User ID
                </span>
                <input
                  value={technicianUserId}
                  onChange={(e) => setTechnicianUserId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="lab.tech.001"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">
                  Truck Plate
                </span>
                <input
                  value={selected.truckLicensePlate}
                  readOnly
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">
                  Moisture Content (%) — max {MAX_MOISTURE}%
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={moistureContentPct}
                  onChange={(e) => setMoistureContentPct(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="13.2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">
                  Aflatoxin (ppb) — max {MAX_AFLATOXIN} ppb
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={aflatoxinPpb}
                  onChange={(e) => setAflatoxinPpb(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="8.4"
                />
              </label>
            </div>

            <div
              className={`rounded-lg px-3 py-2 text-xs border ${
                exceedsSafetyLimit
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              {exceedsSafetyLimit ? (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Values exceed food safety limits — rejection certificate will be issued.
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Values within food safety limits — approval for unloading.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${
                exceedsSafetyLimit ? "bg-red-600" : "bg-emerald-600"
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : exceedsSafetyLimit ? (
                <XCircle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isLoading ? "Submitting..." : actionLabel}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

type Tab = "analysis" | "history";

export function LabAnalysis() {
  const [tab, setTab] = useState<Tab>("analysis");
  const [results, setResults] = useState<LabQCResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    procurementApi.qc
      .listResults("RAW_MATERIAL")
      .then((d) => setResults(d.results as LabQCResult[]))
      .catch(() => setResults([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  // Load history when tab becomes active
  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">Lab Analysis</h1>
        <p className="text-xs text-slate-500 mt-1">
          Role: Lab Technician. Only PENDING_QC trucks are visible and actionable.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(
          [
            { id: "analysis" as Tab, label: "QC Analysis", icon: FlaskConical },
            { id: "history" as Tab, label: "Analysis History", icon: History },
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

      {tab === "analysis" && (
        <LabForm
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
              <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white border border-slate-200 rounded-xl">
              <FlaskConical className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">No lab results yet</p>
              <p className="text-xs">Submit a QC analysis from the QC Analysis tab.</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-400 font-medium">
                {results.length} result{results.length !== 1 ? "s" : ""} — most recent first
              </p>
              {results.map((r) => (
                <QCHistoryRow key={r.id} result={r} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
