import React, { useEffect, useState } from "react";
import {
  Box,
  Loader2,
  CheckCircle,
  AlertCircle,
  Activity,
  Package,
  Trash2,
  Plus,
} from "lucide-react";

export interface PackagingRun {
  id: string;
  runNumber: string;
  operatorName: string;
  baleWeightKg: number;
  flourSpillage: number;
  packagingMaterialReceived: number;
  packagingMaterialConsumed: number;
  packagingMaterialDestroyed: number;
  totalPackagedKg: number;
  yieldPercent: number;
  notes?: string | null;
  createdAt: string;
  finishedProductInputs: Array<{
    consumedKg: number;
    inventoryItem: {
      name: string;
      sku: string;
      type: string;
      unit: string;
    };
  }>;
  finishedProductOutputs: Array<{
    balesProduced: number;
    inventoryItem: {
      name: string;
      sku: string;
      type: string;
      unit: string;
    };
  }>;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  type: "RAW_MATERIAL" | "FINISHED_GOOD" | "BY_PRODUCT";
  unit: string;
  quantity: number;
  unitPrice?: number;
}

type FlourConsumptionRow = { flourInventoryItemId: string; consumedKg: number };
type FlourPackedOutputRow = {
  flourInventoryItemId: string;
  packedBaleInventoryItemId: string;
  balesProduced: number;
};

const BALE_KG = 24;

export function PackagingForm() {
  const [runs, setRuns] = useState<PackagingRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "offline">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [operatorName, setOperatorName] = useState("");

  const [flourSpillage, setFlourSpillage] = useState("0");
  const [packagingMaterialReceived, setPackagingMaterialReceived] = useState("0");
  const [packagingMaterialConsumed, setPackagingMaterialConsumed] = useState("0");
  const [packagingMaterialDestroyed, setPackagingMaterialDestroyed] = useState("0");

  const [flourConsumptionRows, setFlourConsumptionRows] = useState<FlourConsumptionRow[]>([]);
  const [flourPackedOutputs, setFlourPackedOutputs] = useState<FlourPackedOutputRow[]>([]);

  const [notes, setNotes] = useState("");

  const spill = parseFloat(flourSpillage) || 0;
  const totalFlourConsumed = flourConsumptionRows.reduce((s, r) => s + (Number(r.consumedKg) || 0), 0);
  const totalInput = totalFlourConsumed + spill;

  const totalBales = flourPackedOutputs.reduce((s, r) => s + (Number(r.balesProduced) || 0), 0);
  const totalPackaged = totalBales * BALE_KG;

  const yieldPct = totalInput > 0 ? (totalPackaged / totalInput) * 100 : 0;
  const isInvalid = !operatorName.trim() || totalInput <= 0;
  const outputExceeded = totalPackaged > totalInput + 0.01;

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/packaging");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.runs)) {
          setRuns(data.runs);
          setApiStatus("connected");
        }
      } else {
        setApiStatus("offline");
      }
    } catch {
      setApiStatus("offline");
    } finally {
      setLoading(false);
    }
  };

const fetchInventory = async () => {
  try {
    const res = await fetch("/api/inventory");
    if (!res.ok) throw new Error("Failed to fetch inventory");

    const data = await res.json();
    const items: InventoryItem[] = data.items || [];

    setInventoryItems(items);

    const flourItems = items.filter(
      (item) =>
        item.type === "FINISHED_GOOD" &&
        item.unit.toUpperCase() === "KG"
    );

    const baleItems = items.filter(
      (item) =>
        item.type === "FINISHED_GOOD" &&
        ["BAG", "BALE"].includes(item.unit.toUpperCase())
    );

    const defaultBaleId = baleItems[0]?.id ?? "";

    setFlourConsumptionRows(
      flourItems.map((item) => ({
        flourInventoryItemId: item.id,
        consumedKg: 0,
      }))
    );

    setFlourPackedOutputs(
      flourItems.map((item) => ({
        flourInventoryItemId: item.id,
        packedBaleInventoryItemId: defaultBaleId,
        balesProduced: 0,
      }))
    );

  } catch (error) {
    console.error(error);
    setApiStatus("offline");
  }
};

  useEffect(() => {
    fetchRuns();
    fetchInventory();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid || outputExceeded) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      operatorName: operatorName.trim(),
      flourConsumption: flourConsumptionRows.map((r) => ({
        flourInventoryItemId: r.flourInventoryItemId,
        consumedKg: Number(r.consumedKg) || 0,
      })),
      flourSpillage: spill,
      packagingMaterialReceived: parseFloat(packagingMaterialReceived) || 0,
      packagingMaterialConsumed: parseFloat(packagingMaterialConsumed) || 0,
      packagingMaterialDestroyed: parseFloat(packagingMaterialDestroyed) || 0,
      flourPackedOutputs: flourPackedOutputs.map((r) => ({
        flourInventoryItemId: r.flourInventoryItemId,
        packedBaleInventoryItemId: r.packedBaleInventoryItemId,
        balesProduced: Number(r.balesProduced) || 0,
      })),
      baleWeightKg: BALE_KG,
      notes: notes.trim() || undefined,
    };

    try {
      const res = await fetch("/api/packaging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message ?? "Packaging run failed.");
        return;
      }
      setSuccessMessage(`Run ${data.run?.runNumber ?? ""} recorded.`);
      if (data.run) setRuns((prev) => [data.run, ...prev]);
      setOperatorName("");
      setFlourSpillage("0");
      setPackagingMaterialReceived("0");
      setPackagingMaterialConsumed("0");
      setPackagingMaterialDestroyed("0");
      setNotes("");

      setFlourConsumptionRows((prev) => prev.map((r) => ({ ...r, consumedKg: 0 })));
      setFlourPackedOutputs((prev) => prev.map((r) => ({ ...r, balesProduced: 0 })));

    } catch {
      setErrorMessage("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Packaging</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Pack grade 1 &amp; 2 bulk flour into {BALE_KG} kg bales; log spillage and packaging materials.
          </p>
        </div>
        {apiStatus === "connected" ? (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-xl">
            Live API
          </span>
        ) : (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl">
            Offline
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Box className="h-4 w-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">New packaging run</h2>
          </div>

          {errorMessage && (
            <div className="flex gap-2 bg-rose-50 border border-rose-100 p-3 rounded-lg text-[10px] text-rose-600 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="flex gap-2 bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-[10px] text-emerald-700 font-bold">
              <CheckCircle className="h-4 w-4 shrink-0" />
              {successMessage}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase">Operator name</label>
            <input
              required
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-3">
            <div className="text-[9px] font-extrabold text-slate-400 uppercase">Flour types consumed (kg)</div>
            {flourConsumptionRows.length === 0 ? (
              <p className="text-[10px] text-slate-500">No finished-good flour types found in catalogue.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {flourConsumptionRows.map((row, idx) => (
                  <div key={row.flourInventoryItemId} className="space-y-1">
                    <label className="text-[9px] font-extrabold text-slate-400 uppercase">
                      {inventoryItems.find(i => i.id === row.flourInventoryItemId)?.name}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(row.consumedKg)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        setFlourConsumptionRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, consumedKg: v } : r))
                        );
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500 text-slate-800"
                    />
                    <span className="block text-[8px] text-slate-400">
                      SKU: {inventoryItems.find(i => i.id === row.flourInventoryItemId)?.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase">Flour spillage (kg)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={flourSpillage}
              onChange={(e) => setFlourSpillage(e.target.value)}
                className="w-full bg-slate-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500 text-slate-800"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase">Pkg received</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={packagingMaterialReceived}
                onChange={(e) => setPackagingMaterialReceived(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase">Pkg consumed</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={packagingMaterialConsumed}
                onChange={(e) => setPackagingMaterialConsumed(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase">
                Pkg Destroyed
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={packagingMaterialDestroyed}
                onChange={(e) => setPackagingMaterialDestroyed(e.target.value)}
                className="w-full bg-slate-50 border border-rose-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[9px] font-extrabold text-slate-400 uppercase">Bale outputs per flour type</div>
            {flourPackedOutputs.length === 0 ? null : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {flourPackedOutputs.map((row, idx) => (
                  <div key={`${row.flourInventoryItemId}-${idx}`} className="space-y-1">
                    <label className="text-[9px] font-extrabold text-slate-400 uppercase">
                      {inventoryItems.find(i => i.id === row.flourInventoryItemId)?.name} Bale Output
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={String(row.balesProduced)}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        setFlourPackedOutputs((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, balesProduced: v } : r))
                        );
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800"
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-500">Bale SKU selection will be added next; for now the first bale item found is used as default.</p>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs resize-none text-slate-800"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || isInvalid || outputExceeded}
            className="w-full flex items-center justify-center gap-2 bg-[#ff7d12] hover:bg-[#ffa04e] disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition-all"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Record packaging run
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Activity className="h-4 w-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Run summary</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Total flour in</span>
              <span className="font-mono font-black">{totalInput.toFixed(2)} KG</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Packaged out</span>
              <span className="font-mono font-black text-indigo-700">{totalPackaged.toFixed(2)} KG</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Yield</span>
              <span className="font-mono font-black">{yieldPct.toFixed(1)}%</span>
            </div>
          </div>
          {outputExceeded && (
            <p className="text-[10px] text-rose-600 font-bold">Packaged weight exceeds flour input.</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-500" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Recent runs</h2>
          <button
            type="button"
            onClick={fetchRuns}
            className="ml-auto text-[10px] font-bold text-indigo-600 hover:underline"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          </div>
        ) : runs.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-400">No packaging runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Run</th>
                  <th className="px-4 py-3">Operator</th>
                  <th className="px-4 py-3 text-right">Packaged kg</th>
                  <th className="px-4 py-3 text-right">Spill</th>
                  <th className="px-4 py-3 text-right">Yield</th>
                  <th className="px-4 py-3">Flour Consumed</th>
                  <th className="px-4 py-3">Bales Produced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <tr key={r.id} className="text-slate-600">
                    <td className="px-4 py-3 font-mono font-bold">{r.runNumber}</td>
                    <td className="px-4 py-3">{r.operatorName}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.totalPackagedKg.toFixed(1)} KG</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">{r.flourSpillage.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.yieldPercent.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.finishedProductInputs?.map((input, idx) => (
                          <span key={idx} className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-bold whitespace-nowrap">
                            {input.consumedKg.toFixed(1)}kg {input.inventoryItem.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.finishedProductOutputs?.map((output, idx) => (
                          <span key={idx} className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-bold whitespace-nowrap">
                            {output.balesProduced} {output.inventoryItem.unit} of {output.inventoryItem.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
