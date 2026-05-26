import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../app/router/routes";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ArrowLeftRight,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "../../api/apiClient";

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
};

type StoreCode =
  | "MAIN_STORE"
  | "MAIZE_STORE"
  | "PACKAGING_STORE"
  | "DISPATCH_STORE";

type LocationBalance = {
  locationCode: string;
  locationName: string;
  physicalQty: number;
  transitQty: number;
  balance: number;
};

const STORES: Array<{ code: StoreCode; label: string }> = [
  { code: "MAIN_STORE", label: "Main Store" },
  { code: "MAIZE_STORE", label: "Maize Store (Milling)" },
  { code: "PACKAGING_STORE", label: "Packaging Store" },
  { code: "DISPATCH_STORE", label: "Dispatch Store" },
];

export function StockTransferForm() {
  const navigate = useNavigate();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [sourceStoreCode, setSourceStoreCode] = useState<StoreCode>("MAIN_STORE");
  const [destinationStoreCode, setDestinationStoreCode] =
    useState<StoreCode>("MAIZE_STORE");
  const [notes, setNotes] = useState("");
  const [locationBalances, setLocationBalances] = useState<LocationBalance[]>(
    []
  );

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setItems([]);
      setError("Could not load inventory items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    if (!itemId) {
      setLocationBalances([]);
      return;
    }
    fetch(`/api/inventory/location-stock?itemId=${itemId}`)
      .then((r) => r.json())
      .then((json) => {
        setLocationBalances(
          (json.locationStock ?? []).map((ls: LocationBalance & { location?: { code: string; name: string } }) => ({
            locationCode: ls.location?.code ?? ls.locationCode,
            locationName: ls.location?.name ?? ls.locationName,
            physicalQty: ls.physicalQty ?? ls.balance ?? 0,
            transitQty: ls.transitQty ?? 0,
            balance: ls.balance ?? ls.physicalQty ?? 0,
          }))
        );
      })
      .catch(() => setLocationBalances([]));
  }, [itemId]);

  const getStoreBalance = (storeCode: string) =>
    locationBalances.find((b) => b.locationCode === storeCode)?.physicalQty ??
    null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!itemId) {
      setError("Select an inventory item.");
      return;
    }
    const qty = typeof quantity === "string" ? Number(quantity) : quantity;
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    if (sourceStoreCode === destinationStoreCode) {
      setError("Source and destination must differ.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/stock-transfers", {
        method: "POST",
        body: JSON.stringify({
          sourceStoreCode,
          destinationStoreCode,
          notes: notes.trim() || undefined,
          items: [{ itemId, qtyRequested: qty }],
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.message ?? "Failed to create request");
        return;
      }

      navigate(ROUTES.INVENTORY_STOCK_TRANSFERS);
    } catch {
      setError("Network error while creating request.");
    } finally {
      setSubmitting(false);
    }
  };

  const selected = items.find((i) => i.id === itemId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFERS)}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900">New stock request</h1>
          <p className="text-xs text-slate-500 mt-1">
            Creates a PENDING transfer for Main Store approval (no stock deducted yet).
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
      >
        {error && (
          <div className="flex gap-2 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg text-[10px] font-bold text-rose-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase">
            Item
          </label>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs"
            >
              <option value="">Select item</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.sku} — {it.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {selected && (
          <p className="text-[10px] text-slate-500">
            Global on-hand: {selected.quantity.toFixed(3)} {selected.unit}
            {getStoreBalance(sourceStoreCode) != null && (
              <>
                {" "}
                · At {sourceStoreCode}:{" "}
                <span className="font-mono font-bold text-emerald-700">
                  {getStoreBalance(sourceStoreCode)!.toFixed(3)}
                </span>
              </>
            )}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-extrabold text-slate-400 uppercase">
              From (source)
            </label>
            <select
              value={sourceStoreCode}
              onChange={(e) =>
                setSourceStoreCode(e.target.value as StoreCode)
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-1"
            >
              {STORES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-extrabold text-slate-400 uppercase">
              To (your store)
            </label>
            <select
              value={destinationStoreCode}
              onChange={(e) =>
                setDestinationStoreCode(e.target.value as StoreCode)
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-1"
            >
              {STORES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-extrabold text-slate-400 uppercase">
              Quantity requested
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={quantity}
              onChange={(e) => {
               const val = e.target.value;
                  setQuantity(val === "" ? "" : parseFloat(val));
                }}
              placeholder="0"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono mt-1"
            />
          </div>
          <div>
            <label className="text-[9px] font-extrabold text-slate-400 uppercase">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFERS)}
            className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-[#ff7d12] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowLeftRight className="h-3.5 w-3.5" />
            )}
            Submit request
          </button>
        </div>
      </form>
    </div>
  );
}
