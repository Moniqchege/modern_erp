import React, { useMemo, useState } from "react";
import type { GrainIntakeGrnRecord, GrainIntakeGrnStatus } from "../../modules/procurement/types/procurement";

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

export function WeighbridgeOutbound() {
  const [records, setRecords] = useState<GrainIntakeGrnRecord[]>(() => readLocalRecords());
  const [selectedId, setSelectedId] = useState<string>("");
  const [tareWeightKg, setTareWeightKg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const outboundQueue = useMemo(
    () => records.filter((r) => r.status === "READY_TO_UNLOAD" || r.status === "REJECTED"),
    [records]
  );
  const selected = useMemo(
    () => outboundQueue.find((r) => r.id === selectedId) ?? null,
    [outboundQueue, selectedId]
  );

  const grossWeight = selected?.grossWeightKg ?? 0;
  const tareWeight = Number(tareWeightKg);
  const netWeight = Number.isFinite(tareWeight) ? grossWeight - tareWeight : 0;

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!selected) {
      setError("Select a truck from outbound queue.");
      return;
    }
    if (!Number.isFinite(tareWeight) || tareWeight <= 0) {
      setError("Enter a valid tare weight.");
      return;
    }
    if (tareWeight > grossWeight) {
      setError("Tare weight cannot exceed gross weight.");
      return;
    }

    setIsLoading(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    const nextStatus: GrainIntakeGrnStatus = "WEIGHED_OUT";

   const updated: GrainIntakeGrnRecord[] = records.map((record) =>
  record.id === selected.id
    ? {
        ...record,
        tareWeightKg: tareWeight,
        netWeightKg: netWeight,
        weighedOutAt: new Date().toISOString(),
        status: nextStatus,
      }
    : record
);
    writeLocalRecords(updated);
    setRecords(updated);
    setIsLoading(false);
    setSuccess(
      selected.status === "REJECTED"
        ? "Rejected truck finalized and logged out at outbound weighbridge."
        : "Truck turnaround completed successfully."
    );
    setSelectedId("");
    setTareWeightKg("");
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">Weighbridge Outbound</h1>
        <p className="text-xs text-slate-500 mt-1">
          Role: Weighbridge Clerk. Finalize trucks after QC decision and compute net weight.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800">Outbound Queue (READY_TO_UNLOAD / REJECTED)</h2>
        {outboundQueue.length === 0 ? (
          <p className="text-xs text-slate-500">No trucks ready for outbound weighbridge processing.</p>
        ) : (
          <div className="space-y-2">
            {outboundQueue.map((row) => (
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
                <span className="font-semibold">{row.grnNumber}</span> • {row.truckLicensePlate} • {row.status}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleComplete} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-800">Complete Turnaround</h2>
        {!selected ? (
          <p className="text-xs text-slate-500">Select a truck from outbound queue to continue.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Gross Weight (kg)</span>
                <input
                  value={grossWeight.toFixed(3)}
                  readOnly
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Tare Weight (kg)</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={tareWeightKg}
                  onChange={(e) => setTareWeightKg(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="8500"
                />
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">Net Weight (kg)</span>
                <input
                  value={Number.isFinite(netWeight) ? netWeight.toFixed(3) : "0.000"}
                  readOnly
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 font-mono"
                />
              </label>
            </div>

            <p className="text-[11px] text-slate-500">Formula enforced: Gross Weight - Tare Weight = Net Weight</p>

            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
            >
              {isLoading ? "Completing..." : "Complete Turnaround"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

