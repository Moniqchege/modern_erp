import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Loader2,
  CheckCircle,
  AlertCircle,
  Activity,
  Package,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

// ─── Bale types — fixed company enum, never fetched from inventory ────────────

const BALE_TYPES = [
  { key: "NYLON_BALER_0_5KG", label: "Nylon baler 0.5 kg", kgPerUnit: 12 },
  { key: "NYLON_BALER_1KG",   label: "Nylon baler 1 kg",   kgPerUnit: 24 },
  { key: "NYLON_BALER_2KG",   label: "Nylon baler 2 kg",   kgPerUnit: 24 },
  { key: "KHAKI_BALER_0_5KG", label: "Khaki baler 0.5 kg", kgPerUnit: 12 },
  { key: "KHAKI_BALER_1KG",   label: "Khaki baler 1 kg",   kgPerUnit: 24 },
  { key: "KHAKI_BALER_2KG",   label: "Khaki baler 2 kg",   kgPerUnit: 24 },
  { key: "LAMINATED_BALER",   label: "Laminated baler",    kgPerUnit: 24 },
  { key: "BAG_5KG",           label: "Bag 5 kg",           kgPerUnit: 5  },
  { key: "BAG_10KG",          label: "Bag 10 kg",          kgPerUnit: 10 },
  { key: "BAG_50KG",          label: "Bag 50 kg",          kgPerUnit: 50 },
  { key: "BAG_90KG",          label: "Bag 90 kg",          kgPerUnit: 90 },
  { key: "PACKETS_1KG",       label: "Packet 1 kg",        kgPerUnit: 1  },
  { key: "PACKETS_2KG",       label: "Packet 2 kg",        kgPerUnit: 2  },
] as const;

type BaleTypeKey = typeof BALE_TYPES[number]["key"];

// ─── Types that are NOT packaging materials (excluded from the materials table) ─

const NON_PACKAGING_TYPES = new Set([
  "RAW_MATERIAL",
  "FINISHED_GOOD",
  "BY_PRODUCT",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PackagingRun {
  id: string;
  runNumber: string;
  operatorName: string;
  baleWeightKg: number;
  flourSpillage: number;
  totalPackagedKg: number;
  yieldPercent: number;
  electricityKwh?: number | null;
  notes?: string | null;
  createdAt: string;
  finishedProductInputs: Array<{
    flourConsumedKg: number;
    flourSpillageKg?: number;
    inventoryItem: { name: string; sku: string; type: string; unit: string };
  }>;
  finishedProductOutputs: Array<{
    balesProduced: number;
    kgPerUnit?: number;
    packagedKg?: number;
    typeKey?: string;
    inventoryItem?: { name: string; sku: string; type: string; unit: string } | null;
  }>;
}

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  type: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
}

// ─── One output line within a flour block ─────────────────────────────────────

interface OutputLine {
  _key: string;
  typeKey: BaleTypeKey;
  kgPerUnit: number;
  unitsProduced: string;
  packedBaleInventoryItemId: string; // required — which item's balance to credit
}

// ─── One flour consumption block ─────────────────────────────────────────────

interface FlourBlock {
  flourInventoryItemId: string;
  consumedKg: string;
  spillageKg: string;
  outputLines: OutputLine[];
}

// ─── Packaging material row ───────────────────────────────────────────────────

interface PackagingMaterialRow {
  inventoryItemId: string;
  name: string;
  unit: string;
  availableQty: number;
  consumed: string;
  destroyed: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let counter = 0;
const uid = () => `k${++counter}`;

function kgForLine(line: OutputLine): number {
  return (parseFloat(line.unitsProduced) || 0) * line.kgPerUnit;
}

function kgForBlock(block: FlourBlock): number {
  return block.outputLines.reduce((s, l) => s + kgForLine(l), 0);
}

function baleFromKey(key: BaleTypeKey) {
  return BALE_TYPES.find((b) => b.key === key) ?? BALE_TYPES[0];
}

// ─── OutputLineRow ────────────────────────────────────────────────────────────

interface OutputLineRowProps {
  line: OutputLine;
  packagingItems: InventoryItem[]; // baler/bag items from Packaging Store
  onChange: (updated: OutputLine) => void;
  onRemove: () => void;
}

function OutputLineRow({ line, packagingItems, onChange, onRemove }: OutputLineRowProps) {
  const units = parseFloat(line.unitsProduced) || 0;
  const totalKg = units * line.kgPerUnit;

  // Only show items whose type matches the selected bale typeKey
  const matchingItems = packagingItems.filter((it) => it.type === line.typeKey);

  function handleTypeChange(key: string) {
    const bale = baleFromKey(key as BaleTypeKey);
    // Reset item selection when bale type changes
    onChange({ ...line, typeKey: bale.key, kgPerUnit: bale.kgPerUnit, packedBaleInventoryItemId: "" });
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_100px_90px_28px] gap-2 items-center">
        {/* Bale type selector */}
        <select
          aria-label="Bale or bag type"
          value={line.typeKey}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
        >
          {BALE_TYPES.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label} — {b.kgPerUnit} kg/unit
            </option>
          ))}
        </select>

        {/* Units input */}
        <input
          type="number"
          min="0"
          step="1"
          placeholder="0"
          aria-label="Units produced"
          value={line.unitsProduced}
          onChange={(e) => onChange({ ...line, unitsProduced: e.target.value })}
          className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
        />

        {/* Derived kg — read-only */}
        <span className="text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-right">
          {totalKg > 0 ? `${totalKg.toFixed(1)} kg` : "—"}
        </span>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="w-6 h-6 flex items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:border-rose-200 hover:text-rose-500 hover:bg-rose-50 transition-colors"
          aria-label="Remove line"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Brand / item selector — shown when there are matching items in packaging store */}
      {matchingItems.length > 0 && (
        <div className="ml-0 pl-0">
          <select
            aria-label="Brand or inventory item to credit bales to"
            value={line.packedBaleInventoryItemId}
            onChange={(e) => onChange({ ...line, packedBaleInventoryItemId: e.target.value })}
            className={`w-full bg-white border rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 ${
              !line.packedBaleInventoryItemId ? "border-amber-300" : "border-slate-200"
            }`}
          >
            <option value="">— Select brand / item to credit bales to —</option>
            {matchingItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} ({it.sku})
              </option>
            ))}
          </select>
          {!line.packedBaleInventoryItemId && (
            <p className="text-[9px] text-amber-600 font-bold mt-0.5 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Select which item these bales belong to so they appear in bale stock
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FlourBlockCard ───────────────────────────────────────────────────────────

interface FlourBlockProps {
  block: FlourBlock;
  flourItem: InventoryItem | undefined;
  packagingItems: InventoryItem[];
  onChange: (updated: FlourBlock) => void;
}

function FlourBlockCard({ block, flourItem, packagingItems, onChange }: FlourBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  const consumed = parseFloat(block.consumedKg) || 0;
  const spillage = parseFloat(block.spillageKg) || 0;
  const totalIn = consumed + spillage;
  const allocatedKg = kgForBlock(block);
  const diff = consumed - allocatedKg;
  const isOver = diff < -0.01;
  const isBalanced = consumed > 0 && Math.abs(diff) <= 0.01;

  function addLine() {
    const defaultBale = BALE_TYPES[0];
    onChange({
      ...block,
      outputLines: [
        ...block.outputLines,
        {
          _key: uid(),
          typeKey: defaultBale.key,
          kgPerUnit: defaultBale.kgPerUnit,
          unitsProduced: "",
          packedBaleInventoryItemId: "",
        },
      ],
    });
  }

  function updateLine(idx: number, updated: OutputLine) {
    const lines = [...block.outputLines];
    lines[idx] = updated;
    onChange({ ...block, outputLines: lines });
  }

  function removeLine(idx: number) {
    onChange({ ...block, outputLines: block.outputLines.filter((_, i) => i !== idx) });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate">
            {flourItem?.name ?? block.flourInventoryItemId}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">{flourItem?.sku}</p>
        </div>

        {/* Consumed kg input */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Consumed</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={block.consumedKg}
            onChange={(e) => onChange({ ...block, consumedKg: e.target.value })}
            className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
          />
          <span className="text-[10px] text-slate-400">kg</span>
        </div>

        {/* Per-flour spillage input */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold text-amber-500 uppercase">Spillage</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={block.spillageKg}
            onChange={(e) => onChange({ ...block, spillageKg: e.target.value })}
            className="w-24 bg-white border border-amber-200 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
          />
          <span className="text-[10px] text-slate-400">kg</span>
        </div>

        {/* Balance badge */}
        {totalIn > 0 && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              isOver
                ? "bg-rose-50 text-rose-600 border border-rose-100"
                : isBalanced
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-amber-50 text-amber-700 border border-amber-100"
            }`}
          >
            {isBalanced
              ? "Balanced"
              : isOver
              ? `${Math.abs(diff).toFixed(1)} kg over`
              : `${diff.toFixed(1)} kg left`}
          </span>
        )}

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded text-slate-400 hover:text-slate-600"
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Output lines body */}
      {!collapsed && (
        <div className="px-4 py-3 space-y-2">
          {block.outputLines.length > 0 && (
            <div className="grid grid-cols-[1fr_100px_90px_28px] gap-2 mb-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase">Bale / bag type</span>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase">Units</span>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase text-right pr-1">= kg</span>
              <span />
            </div>
          )}

          {block.outputLines.map((line, idx) => (
            <OutputLineRow
              key={line._key}
              line={line}
              packagingItems={packagingItems}
              onChange={(updated) => updateLine(idx, updated)}
              onRemove={() => removeLine(idx)}
            />
          ))}

          {block.outputLines.length === 0 && (
            <p className="text-[11px] text-slate-400 py-1">
              No output lines yet — add a bale or bag type below.
            </p>
          )}

          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold mt-1"
          >
            <Plus className="h-3 w-3" />
            Add bale / bag type
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main PackagingForm ───────────────────────────────────────────────────────

export function PackagingForm() {
  const [runs, setRuns] = useState<PackagingRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "offline">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [operatorName, setOperatorName] = useState("");
  // Electricity kWh — persisted as a "constant" setting across runs
  const [electricityKwh, setElectricityKwh] = useState<string>(() =>
    localStorage.getItem("packaging_electricity_kwh") ?? ""
  );
  const [notes, setNotes] = useState("");

  const [flourBlocks, setFlourBlocks] = useState<FlourBlock[]>([]);
  const [packagingMaterialRows, setPackagingMaterialRows] = useState<PackagingMaterialRow[]>([]);
  const [packagingSearch, setPackagingSearch] = useState("");

  // ── Derived ───────────────────────────────────────────────────────────────

  const flourItems = useMemo(
    () =>
      inventoryItems.filter(
        (i) => i.type === "FINISHED_GOOD" && i.unit.toUpperCase() === "KG"
      ),
    [inventoryItems]
  );

  // Packaging materials = consumables only (tapes, glue, etc.) — NOT bale types
  const filteredPackagingRows = useMemo(() => {
    const q = packagingSearch.trim().toLowerCase();
    if (!q) return packagingMaterialRows;
    return packagingMaterialRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.inventoryItemId.toLowerCase().includes(q)
    );
  }, [packagingSearch, packagingMaterialRows]);

  // ── Summary maths ─────────────────────────────────────────────────────────

  const totalFlourConsumed = flourBlocks.reduce(
    (s, b) => s + (parseFloat(b.consumedKg) || 0),
    0
  );
  const totalFlourSpillage = flourBlocks.reduce(
    (s, b) => s + (parseFloat(b.spillageKg) || 0),
    0
  );
  const totalInput = totalFlourConsumed + totalFlourSpillage;
  const totalPackagedKg = flourBlocks.reduce((s, b) => s + kgForBlock(b), 0);
  const yieldPct = totalInput > 0 ? (totalPackagedKg / totalInput) * 100 : 0;
  const outputExceeded = totalPackagedKg > totalInput + 0.01;

  const isInvalid =
    !operatorName.trim() ||
    totalInput <= 0 ||
    flourBlocks.every((b) => b.outputLines.length === 0);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchRuns = useCallback(async () => {
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
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      // Fetch all items for flour blocks
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      const data = await res.json();
      const items: InventoryItem[] = data.items || [];
      setInventoryItems(items);

      // One flour block per finished-good KG item
      const flour = items.filter(
        (i) => i.type === "FINISHED_GOOD" && i.unit.toUpperCase() === "KG"
      );
      setFlourBlocks(
        flour.map((item) => ({
          flourInventoryItemId: item.id,
          consumedKg: "",
          spillageKg: "",
          outputLines: [],
        }))
      );

      // Packaging materials — fetch scoped to PACKAGING_STORE so we only show
      // items physically present there and the quantity reflects that store's balance
      const pkgRes = await fetch("/api/inventory?storeCode=PACKAGING_STORE");
      if (!pkgRes.ok) throw new Error("Failed to fetch packaging store inventory");
      const pkgData = await pkgRes.json();
      const pkgItems: InventoryItem[] = pkgData.items || [];

      const pkgMaterials = pkgItems.filter((i) => !NON_PACKAGING_TYPES.has(i.type));
      setPackagingMaterialRows(
        pkgMaterials.map((item) => ({
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          availableQty: item.quantity,
          consumed: "",
          destroyed: "",
        }))
      );
    } catch {
      setApiStatus("offline");
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    fetchInventory();
  }, [fetchRuns, fetchInventory]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid || outputExceeded) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      operatorName: operatorName.trim(),
      flourConsumption: flourBlocks
        .filter((b) => parseFloat(b.consumedKg) > 0 || parseFloat(b.spillageKg) > 0)
        .map((b) => ({
          flourInventoryItemId: b.flourInventoryItemId,
          consumedKg: parseFloat(b.consumedKg) || 0,
          spillageKg: parseFloat(b.spillageKg) || 0,
        })),
      packagingMaterials: packagingMaterialRows.map((r) => ({
        inventoryItemId: r.inventoryItemId,
        received: 0,
        consumed: parseFloat(r.consumed) || 0,
        destroyed: parseFloat(r.destroyed) || 0,
      })),
      flourPackedOutputs: flourBlocks
        .filter((b) => b.outputLines.length > 0)
        .map((b) => ({
          flourInventoryItemId: b.flourInventoryItemId,
          outputLines: b.outputLines
            .filter((l) => parseFloat(l.unitsProduced) > 0)
            .map((l) => ({
              typeKey: l.typeKey,
              unitsProduced: parseFloat(l.unitsProduced) || 0,
              kgPerUnit: l.kgPerUnit,
              ...(l.packedBaleInventoryItemId
                ? { packedBaleInventoryItemId: l.packedBaleInventoryItemId }
                : {}),
            })),
        }))
        .filter((o) => o.outputLines.length > 0),
      electricityKwh: parseFloat(electricityKwh) > 0 ? parseFloat(electricityKwh) : undefined,
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

      // Persist electricity kWh for next run
      if (electricityKwh) localStorage.setItem("packaging_electricity_kwh", electricityKwh);

      // Reset form
      setOperatorName("");
      setNotes("");
      setFlourBlocks((prev) =>
        prev.map((b) => ({ ...b, consumedKg: "", spillageKg: "", outputLines: [] }))
      );
      setPackagingMaterialRows((prev) =>
        prev.map((r) => ({ ...r, consumed: "", destroyed: "" }))
      );
    } catch {
      setErrorMessage("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Packaging</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Pack bulk flour into bales, bags &amp; packets; log spillage and packaging materials.
          </p>
        </div>
        <span
          className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border ${
            apiStatus === "connected"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200/60"
              : "text-amber-700 bg-amber-50 border-amber-200/60"
          }`}
        >
          {apiStatus === "connected" ? "Live API" : "Offline"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Form ── */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Box className="h-4 w-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              New packaging run
            </h2>
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

          {/* Operator name */}
          <div className="space-y-1">
            <label htmlFor="operator-name" className="text-[9px] font-extrabold text-slate-400 uppercase">
              Operator name*
            </label>
            <input
              id="operator-name"
              required
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* ── Flour blocks ── */}
          <div className="space-y-2">
            <div className="text-[9px] font-extrabold text-slate-400 uppercase">
              Flour consumed &amp; bale / bag outputs
            </div>
            <p className="text-[10px] text-slate-400">
              For each flour type, enter how much was consumed, then add one line per bale or bag
              type produced from it. Weight per unit is calculated automatically.
            </p>

            {flourBlocks.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                No finished-good flour types found in catalogue.
              </p>
            ) : (
              <div className="space-y-3">
                {flourBlocks.map((block, idx) => {
                  const flourItem = inventoryItems.find(
                    (i) => i.id === block.flourInventoryItemId
                  );
                  return (
                    <FlourBlockCard
                      key={block.flourInventoryItemId}
                      block={block}
                      flourItem={flourItem}
                      packagingItems={inventoryItems.filter(
                        (i) => !NON_PACKAGING_TYPES.has(i.type)
                      )}
                      onChange={(updated) =>
                        setFlourBlocks((prev) =>
                          prev.map((b, i) => (i === idx ? updated : b))
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Packaging materials ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[9px] font-extrabold text-slate-400 uppercase">
                Packaging materials
              </div>
              <span className="text-[9px] text-slate-400">From Packaging Store</span>
            </div>
            <input
              value={packagingSearch}
              onChange={(e) => setPackagingSearch(e.target.value)}
              placeholder="Search packaging material..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
            />
            <div className="max-h-72 overflow-y-auto pr-1 space-y-2 border border-slate-100 rounded-xl p-2 bg-white">
              {filteredPackagingRows.length === 0 ? (
                <p className="text-[10px] text-slate-500 p-2">
                  No packaging materials in Packaging Store. Transfer stock to Packaging Store first.
                </p>
              ) : (
                filteredPackagingRows.map((row) => {
                  const consumed = parseFloat(row.consumed) || 0;
                  const destroyed = parseFloat(row.destroyed) || 0;
                  const totalOut = consumed + destroyed;
                  const overStock = totalOut > row.availableQty + 0.001;
                  return (
                    <div
                      key={row.inventoryItemId}
                      className={`grid grid-cols-2 md:grid-cols-5 gap-3 p-2 border rounded-lg ${
                        overStock ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase">
                          Material
                        </label>
                        <p className="text-xs font-bold text-slate-700">{row.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">
                          In stock: {row.availableQty.toFixed(2)} {row.unit.toLowerCase()}
                        </p>
                      </div>
                      {(["consumed", "destroyed"] as const).map((field) => (
                        <div key={field} className="space-y-1 md:col-span-1">
                          <label className="text-[9px] font-extrabold text-slate-400 uppercase">
                            {field}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0"
                            value={row[field]}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPackagingMaterialRows((prev) =>
                                prev.map((r) =>
                                  r.inventoryItemId === row.inventoryItemId
                                    ? { ...r, [field]: v }
                                    : r
                                )
                              );
                            }}
                            className={`w-full bg-white border rounded-lg px-3 py-1.5 text-xs font-mono ${
                              field === "destroyed"
                                ? "border-rose-200"
                                : overStock
                                ? "border-rose-300"
                                : "border-slate-200"
                            }`}
                          />
                        </div>
                      ))}
                      {overStock && (
                        <div className="md:col-span-5 flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                          <AlertCircle className="h-3 w-3" />
                          Exceeds packaging store stock ({row.availableQty.toFixed(2)} available)
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Electricity ── */}
          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-500" />
              Electricity used (kWh) — saved for next run
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              placeholder="0.000"
              value={electricityKwh}
              onChange={(e) => {
                setElectricityKwh(e.target.value);
                localStorage.setItem("packaging_electricity_kwh", e.target.value);
              }}
              className="w-full bg-slate-50 border border-yellow-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-yellow-400 text-slate-800"
            />
          </div>

          {/* ── Notes ── */}
          <div className="space-y-1">
            <label htmlFor="packaging-notes" className="text-[9px] font-extrabold text-slate-400 uppercase">Notes</label>
            <textarea
              id="packaging-notes"
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
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Record packaging run
          </button>
        </form>

        {/* ── Run summary sidebar ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Activity className="h-4 w-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Run summary
            </h2>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Total flour in</span>
              <span className="font-mono font-black">{totalInput.toFixed(2)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Total spillage</span>
              <span className="font-mono font-black text-amber-600">{totalFlourSpillage.toFixed(2)} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Packaged out</span>
              <span
                className={`font-mono font-black ${
                  outputExceeded ? "text-rose-600" : "text-indigo-700"
                }`}
              >
                {totalPackagedKg.toFixed(2)} kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Yield</span>
              <span className="font-mono font-black">
                {totalInput > 0 ? `${yieldPct.toFixed(1)}%` : "—"}
              </span>
            </div>
            {parseFloat(electricityKwh) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-1">
                  <Zap className="h-3 w-3 text-yellow-500" /> Electricity
                </span>
                <span className="font-mono font-black text-yellow-600">
                  {parseFloat(electricityKwh).toFixed(3)} kWh
                </span>
              </div>
            )}

            {/* Per-flour breakdown */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase">By flour type</p>
              {flourBlocks.map((b) => {
                const item = inventoryItems.find((i) => i.id === b.flourInventoryItemId);
                const consumed = parseFloat(b.consumedKg) || 0;
                const spillage = parseFloat(b.spillageKg) || 0;
                const allocated = kgForBlock(b);
                if (consumed === 0 && allocated === 0 && spillage === 0) return null;
                return (
                  <div key={b.flourInventoryItemId} className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-600 truncate">
                      {item?.name ?? "—"}
                    </p>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Consumed</span>
                      <span className="font-mono">{consumed.toFixed(1)} kg</span>
                    </div>
                    {spillage > 0 && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-amber-500">Spillage</span>
                        <span className="font-mono text-amber-600">{spillage.toFixed(1)} kg</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Allocated to outputs</span>
                      <span
                        className={`font-mono ${
                          allocated > consumed + 0.01 ? "text-rose-600" : ""
                        }`}
                      >
                        {allocated.toFixed(1)} kg
                      </span>
                    </div>
                    {b.outputLines.length > 0 && (
                      <div className="pl-2 space-y-0.5">
                        {b.outputLines.map((l) => {
                          const units = parseFloat(l.unitsProduced) || 0;
                          if (units === 0) return null;
                          const bale = baleFromKey(l.typeKey);
                          return (
                            <div
                              key={l._key}
                              className="flex justify-between text-[10px] text-slate-400"
                            >
                              <span className="truncate mr-2">{bale.label}</span>
                              <span className="font-mono shrink-0">
                                {units} × {l.kgPerUnit} kg
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {outputExceeded && (
            <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Packaged weight exceeds flour input.
            </p>
          )}
        </div>
      </div>

      {/* ── Recent runs table ── */}
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
                  <th className="px-4 py-3 text-right">kWh</th>
                  <th className="px-4 py-3">Flour consumed</th>
                  <th className="px-4 py-3">Outputs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <tr key={r.id} className="text-slate-600">
                    <td className="px-4 py-3 font-mono font-bold">{r.runNumber}</td>
                    <td className="px-4 py-3">{r.operatorName}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {Number(r.totalPackagedKg).toFixed(1)} kg
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">
                      {Number(r.flourSpillage).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {Number(r.yieldPercent).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-yellow-700">
                      {r.electricityKwh != null ? Number(r.electricityKwh).toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.finishedProductInputs?.map((inp, i) => (
                          <span
                            key={i}
                            className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-bold whitespace-nowrap"
                          >
                            {Number(inp.flourConsumedKg).toFixed(1)} kg {inp.inventoryItem.name}
                            {inp.flourSpillageKg != null && Number(inp.flourSpillageKg) > 0
                              ? ` (+${Number(inp.flourSpillageKg).toFixed(1)} spill)`
                              : ""}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.finishedProductOutputs?.map((out, i) => {
                          const bale = BALE_TYPES.find((b) => b.key === out.typeKey);
                          return (
                            <span
                              key={i}
                              className="text-[9px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 text-indigo-700 font-bold whitespace-nowrap"
                            >
                              {Number(out.balesProduced)} ×{" "}
                              {bale?.label ?? out.typeKey ?? "Output"}
                            </span>
                          );
                        })}
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