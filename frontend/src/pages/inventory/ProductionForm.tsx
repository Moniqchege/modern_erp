import React, { useState, useEffect } from "react";
import {
  Factory,
  Wheat,
  Scale,
  Activity,
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Percent,
  Warehouse,
} from "lucide-react";

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  rawMaizeConsumed: number;
  grade1Produced: number;
  grade2Produced: number;
  maizeJamProduced: number;
  wasteLoss: number;
  efficiency: number;
  createdAt: string;
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

const MOCK_BATCHES: ProductionBatch[] = [
  {
    id: "b_1",
    batchNumber: "M-BATCH-832104",
    rawMaizeConsumed: 500.00,
    grade1Produced: 320.00,
    grade2Produced: 120.00,
    maizeJamProduced: 42.00,
    wasteLoss: 18.00,
    efficiency: 96.40,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), 
  },
  {
    id: "b_2",
    batchNumber: "M-BATCH-832049",
    rawMaizeConsumed: 1000.00,
    grade1Produced: 640.00,
    grade2Produced: 245.00,
    maizeJamProduced: 85.00,
    wasteLoss: 30.00,
    efficiency: 97.00,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(), 
  },
];

export function ProductionForm() {
  const [batches, setBatches] = useState<ProductionBatch[]>(MOCK_BATCHES);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "offline">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [rawMaizeConsumed, setRawMaizeConsumed] = useState<string>("0");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [productionOutputs, setProductionOutputs] = useState<
  Record<string, string>
>({});

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/production");
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.batches)) {
          setBatches(data.batches.length > 0 ? data.batches : MOCK_BATCHES);
          setApiStatus("connected");
        }
      } else {
        setApiStatus("offline");
      }
    } catch (e) {
      setApiStatus("offline");
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
  try {
    const response = await fetch("/api/inventory");

    if (!response.ok) {
      throw new Error("Failed to fetch inventory");
    }

    const data = await response.json();
    setInventoryItems(data.items || []);
    const initialOutputs: Record<string, string> = {};
    data.items.forEach((item: InventoryItem) => {
      if (
        item.type === "FINISHED_GOOD" ||
        item.type === "BY_PRODUCT"
      ) {
        initialOutputs[item.id] = "0";
      }
    });

    setProductionOutputs(initialOutputs);
  } catch (error) {
    console.error(error);
  }
};

  useEffect(() => {
    fetchBatches();
    fetchInventory();
  }, []);

const finishedGoods = inventoryItems.filter(
  (item) => item.type === "FINISHED_GOOD"
);

const byProducts = inventoryItems.filter(
  (item) => item.type === "BY_PRODUCT"
);

const rawMaterials = inventoryItems.filter(
  (item) => item.type === "RAW_MATERIAL"
);

  // Parse inputs safely
  const inputMaize = parseFloat(rawMaizeConsumed) || 0;
  const totalOutput = Object.values(productionOutputs).reduce(
  (sum, value) => sum + (parseFloat(value) || 0),
  0
);
  const wasteLoss = inputMaize > 0 ? inputMaize - totalOutput : 0;
  const efficiency = inputMaize > 0 ? (totalOutput / inputMaize) * 100 : 0;
  const lossPercentage = inputMaize > 0 ? (wasteLoss / inputMaize) * 100 : 0;

  const isOutputExceeded = totalOutput > inputMaize;
  const isInvalidInput = inputMaize <= 0;

  const handleProcessBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalidInput || isOutputExceeded) return;

    const payload = {
  rawMaizeConsumed: inputMaize,
  outputs: Object.entries(productionOutputs).map(
    ([inventoryItemId, quantity]) => ({
      inventoryItemId,
      quantity: parseFloat(quantity) || 0,
    })
  ),
};

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (apiStatus === "connected") {
      try {
        const response = await fetch("/api/production", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json();
          setBatches((prev) => [data.batch, ...prev]);
          setSuccessMessage(`Production batch processed successfully! Spec logged as ${data.batch.batchNumber}.`);
          resetForm();
        } else {
          const err = await response.json();
          setErrorMessage(err.message || "Failed to process batch run.");
        }
      } catch (e) {
        setErrorMessage("Network request failed. Please check backend status.");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Simulate locally
      setTimeout(() => {
        const grade1Item = finishedGoods[0];
const grade2Item = finishedGoods[1];
const maizeJamItem = byProducts[0];

const mockNew: ProductionBatch = {
  id: `local_b_${Date.now()}`,
  batchNumber: `M-BATCH-${Date.now().toString().slice(-6)}`,

  rawMaizeConsumed: inputMaize,

  grade1Produced: grade1Item
    ? parseFloat(productionOutputs[grade1Item.id] || "0")
    : 0,

  grade2Produced: grade2Item
    ? parseFloat(productionOutputs[grade2Item.id] || "0")
    : 0,

  maizeJamProduced: maizeJamItem
    ? parseFloat(productionOutputs[maizeJamItem.id] || "0")
    : 0,

  wasteLoss,
  efficiency,
  createdAt: new Date().toISOString(),
};

        setBatches((prev) => [mockNew, ...prev]);
        setSuccessMessage(`Demo Mode: Milled batch logged locally as ${mockNew.batchNumber}.`);
        resetForm();
        setSubmitting(false);
      }, 500);
    }
  };

  const resetForm = () => {
  setRawMaizeConsumed("0");

  const clearedOutputs: Record<string, string> = {};

  inventoryItems.forEach((item) => {
    if (
      item.type === "FINISHED_GOOD" ||
      item.type === "BY_PRODUCT"
    ) {
      clearedOutputs[item.id] = "0";
    }
  });

  setProductionOutputs(clearedOutputs);
};

  const getEfficiencyBadge = (eff: number) => {
    if (eff >= 96) {
      return (
        <span className="inline-block text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-lg">
          Optimal ({eff.toFixed(2)}%)
        </span>
      );
    }
    if (eff >= 93) {
      return (
        <span className="inline-block text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-lg">
          Standard ({eff.toFixed(2)}%)
        </span>
      );
    }
    return (
      <span className="inline-block text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200/50 px-2 py-0.5 rounded-lg">
        Low Yield ({eff.toFixed(2)}%)
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Maize Milling Production</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Mill raw maize kernels into finished flour grades and by-products with live yield calculations.
          </p>
        </div>

        <div>
          {apiStatus === "connected" ? (
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm">
              <CheckCircle className="h-3.5 w-3.5" /> Operations System Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 bg-amber-55 text-amber-750 border border-amber-200/60 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm">
              <AlertCircle className="h-3.5 w-3.5" /> Simulation Sandbox
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Batch Form */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-650">
                <Factory className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Milling Intake & Yield Log</h2>
            </div>

            {successMessage && (
              <div className="flex gap-2.5 bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-xs text-emerald-750 font-semibold shadow-inner">
                <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex gap-2.5 bg-rose-50 border border-rose-100 p-4 rounded-xl text-xs text-rose-700 font-semibold shadow-inner">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleProcessBatch} className="space-y-5">
              {/* Raw Input */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-amber-600 font-bold text-xs">
                  <Wheat className="h-4 w-4" />
                  <span>RAW INPUT MATERIAL</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase">Raw Maize Consumed (KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={rawMaizeConsumed}
                    onChange={(e) => setRawMaizeConsumed(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-mono font-bold"
                  />
                  <span className="block text-[9px] text-slate-400 font-medium">Standard intake SKU: MZ-RAW-01</span>
                </div>
              </div>

              {/* Co-products outputs */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                  <Warehouse className="h-4 w-4" />
                  <span>FINISHED PRODUCTS & BY-PRODUCTS</span>
                </div>

                <div className="space-y-5">
  {/* Finished Goods */}
  {finishedGoods.length > 0 && (
    <div>
      <h3 className="text-[10px] font-black uppercase text-emerald-700 mb-1">
        Finished Goods
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {finishedGoods.map((item) => (
          <div key={item.id} className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-455 uppercase">
              {item.name} ({item.unit})
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={productionOutputs[item.id] || "0"}
              onChange={(e) =>
                setProductionOutputs((prev) => ({
                  ...prev,
                  [item.id]: e.target.value,
                }))
              }
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-mono"
            />

            <span className="block text-[8px] text-slate-400">
              SKU: {item.sku}
            </span>
          </div>
        ))}
      </div>
    </div>
  )}

  {/* By Products */}
  {byProducts.length > 0 && (
    <div>
      <h3 className="text-[10px] font-black uppercase text-amber-700 mb-1">
        By Products
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {byProducts.map((item) => (
          <div key={item.id} className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-455 uppercase">
              {item.name} ({item.unit})
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={productionOutputs[item.id] || "0"}
              onChange={(e) =>
                setProductionOutputs((prev) => ({
                  ...prev,
                  [item.id]: e.target.value,
                }))
              }
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-mono"
            />

            <span className="block text-[8px] text-slate-400">
              SKU: {item.sku}
            </span>
          </div>
        ))}
      </div>
    </div>
  )}
</div>
              </div>

              {isOutputExceeded && (
                <div className="flex gap-2 bg-rose-50 border border-rose-100 p-3 rounded-lg text-[10px] text-rose-600 font-bold">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Total output ({totalOutput.toFixed(2)} KG) exceeds raw input grain ({inputMaize.toFixed(2)} KG). Check weights.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-655 font-bold text-xs px-6 py-2.5 rounded-xl transition-all active:scale-95"
                >
                  Clear Fields
                </button>
                <button
                  type="submit"
                  disabled={submitting || isInvalidInput || isOutputExceeded}
                  className={`flex items-center gap-2 bg-[#ff7d12] hover:bg-[#ffc28f] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95 ${
                    (submitting || isInvalidInput || isOutputExceeded) && "opacity-50 cursor-not-allowed"
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing Transaction...
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4" /> Finalize Milling Batch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Real-time yield indicators card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-650">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Live Milling Analytics</h2>
            </div>

            {/* Calculations Feed */}
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Input Grain</span>
                <span className="font-mono text-xs font-black text-slate-900">
                  {inputMaize.toFixed(2)} KG
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Output Products</span>
                <span className="font-mono text-xs font-black text-indigo-700">
                  {totalOutput.toFixed(2)} KG
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Waste / Milling Loss</span>
                <span className={`font-mono text-xs font-black ${wasteLoss > 0 ? "text-amber-600" : "text-slate-800"}`}>
                  {wasteLoss.toFixed(2)} KG
                </span>
              </div>

              {/* Progress bar gauge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Milling Efficiency</span>
                  <span className={`font-mono font-black ${
                    efficiency >= 96 ? "text-emerald-600" : efficiency >= 93 ? "text-indigo-655" : "text-rose-600"
                  }`}>
                    {efficiency.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div
                    className={`h-full transition-all duration-350 rounded-full ${
                      efficiency >= 96 ? "bg-emerald-500" : efficiency >= 93 ? "bg-indigo-600" : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(efficiency, 100)}%` }}
                  />
                </div>
              </div>

              {/* Loss bar gauge */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Waste Loss Rate</span>
                  <span className="font-mono font-black text-slate-700">
                    {lossPercentage.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
                  <div
                    className="h-full bg-amber-500 transition-all duration-350 rounded-full"
                    style={{ width: `${Math.min(lossPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-[10px] text-slate-500 leading-relaxed font-semibold mt-4">
            <span className="block text-[9px] font-extrabold uppercase text-slate-450 tracking-wider mb-1">Traceability target</span>
            To maintain manufacturing certifications, milling batch runs must keep waste/loss rates below 5.00% (equivalent to 95.00% output efficiency).
          </div>
        </div>
      </div>

      {/* Production Traceability History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Production Run Logs (Traceability)</h3>
          <p className="text-[10px] text-slate-500 font-semibold mt-1">Silo-to-Flour physical conversion audit trail.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-extrabold tracking-widest uppercase">
                <th className="px-6 py-4.5">Batch Code</th>
                <th className="px-6 py-4.5">Date & Time</th>
                <th className="px-6 py-4.5 text-right">Maize Consumed (KG)</th>
                <th className="px-6 py-4.5 text-right">Grade 1 Flour (KG)</th>
                <th className="px-6 py-4.5 text-right">Grade 2 Flour (KG)</th>
                <th className="px-6 py-4.5 text-right">Maize Jam (KG)</th>
                <th className="px-6 py-4.5 text-right">Waste Loss</th>
                <th className="px-6 py-4.5 text-center">Yield Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-655 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-650" /> Syncing batch audits...
                    </div>
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400 font-semibold">
                    No production runs recorded yet.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-extrabold text-indigo-650 select-all">
                      {b.batchNumber}
                    </td>
                    <td className="px-6 py-4 text-slate-455 text-[10px]">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                      {Number(b.rawMaizeConsumed).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-700">
                      {Number(b.grade1Produced).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-700">
                      {Number(b.grade2Produced).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-700">
                      {Number(b.maizeJamProduced).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-amber-600 font-bold">
                      {Number(b.wasteLoss).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getEfficiencyBadge(Number(b.efficiency))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
