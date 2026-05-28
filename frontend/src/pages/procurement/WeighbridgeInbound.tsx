import React, { useState } from "react";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type { GrainIntakeGrnRecord } from "../../modules/procurement/types/procurement";

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

export function WeighbridgeInbound() {
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
    if (!supplierName.trim() || !truckPlate.trim() || !driverName.trim() || !Number.isFinite(gross) || gross <= 0) {
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
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-black text-slate-900">Weighbridge Inbound</h1>
        <p className="text-xs text-slate-500 mt-1">
          Role: Weighbridge Clerk. Register incoming truck gross weights only.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
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
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
        >
          {isLoading ? "Registering..." : "Register Inbound Truck"}
        </button>
      </form>
    </div>
  );
}

