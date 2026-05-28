import React, { useMemo, useState } from "react";
import type { GrainIntakeGrnRecord, GrainIntakeGrnStatus } from "../../modules/procurement/types/procurement";

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

export function LabAnalysis() {
  const [records, setRecords] = useState<GrainIntakeGrnRecord[]>(() => readLocalRecords());
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

  const actionLabel = exceedsSafetyLimit ? "Issue Rejection Certificate" : "Approve for Unloading";

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
    if (!Number.isFinite(moisture) || moisture < 0 || !Number.isFinite(aflatoxin) || aflatoxin < 0) {
      setError("Enter valid moisture and aflatoxin values.");
      return;
    }

    setIsLoading(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 700));

    const nextStatus: GrainIntakeGrnStatus = exceedsSafetyLimit
  ? "REJECTED"
  : "READY_TO_UNLOAD";

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
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">Lab Analysis</h1>
        <p className="text-xs text-slate-500 mt-1">
          Role: Lab Technician. Only `PENDING_QC` trucks are visible and actionable.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </div>
      )}

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
                <span className="font-semibold">{row.grnNumber}</span> • {row.truckLicensePlate} • {row.supplierName}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800">QC Analysis Form</h2>
        {!selected ? (
          <p className="text-xs text-slate-500">Select a pending truck to begin analysis.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Technician User ID</span>
                <input
                  value={technicianUserId}
                  onChange={(e) => setTechnicianUserId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="lab.tech.001"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Truck Plate</span>
                <input value={selected.truckLicensePlate} readOnly className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50" />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Moisture Content (%)</span>
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
                <span className="text-[11px] font-semibold text-slate-600">Aflatoxin (ppb)</span>
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

            <div className={`rounded-lg px-3 py-2 text-xs border ${exceedsSafetyLimit ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              Safety limits: moisture ≤ {MAX_MOISTURE}% and aflatoxin ≤ {MAX_AFLATOXIN} ppb.
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${
                exceedsSafetyLimit ? "bg-red-600" : "bg-emerald-600"
              }`}
            >
              {isLoading ? "Submitting..." : actionLabel}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

