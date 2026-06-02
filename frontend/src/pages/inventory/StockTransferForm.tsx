import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../app/router/routes";
import { ArrowLeft, Loader2, ArrowLeftRight, AlertCircle } from "lucide-react";
import { apiFetch } from "../../api/apiClient";
import { getCurrentUser } from "../../auth/authClient";

type InventoryItem = { id: string; sku: string; name: string; unit: string; quantity: number };
type Store = { id: string; code: string; name: string; isActive: boolean };

type LocationBalance = {
  locationCode: string; locationName: string;
  physicalQty: number; transitQty: number; balance: number;
};

export function StockTransferForm() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingStores, setLoadingStores] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [sourceStoreCode, setSourceStoreCode] = useState("");
  const [destinationStoreCode, setDestinationStoreCode] = useState("");
  const [notes, setNotes] = useState("");
  const [locationBalances, setLocationBalances] = useState<LocationBalance[]>([]);

  // My own store (for non-admins)
  const [myStoreCode, setMyStoreCode] = useState<string | null>(null);

  // Load stores from API
  useEffect(() => {
    apiFetch("/api/stores")
      .then((r) => r.json())
      .then((j: { stores: Store[] }) => {
        const active = (j.stores ?? []).filter((s) => s.isActive);
        setStores(active);
        if (active.length > 0) setSourceStoreCode(active[0].code);
        if (active.length > 1) setDestinationStoreCode(active[1].code);
      })
      .catch(() => setError("Could not load stores."))
      .finally(() => setLoadingStores(false));
  }, []);

  // Resolve non-admin's own store and pre-select as destination
  useEffect(() => {
    if (isAdmin) return;
    apiFetch("/api/stores/me")
      .then((r) => r.json())
      .then((j: { storeCode: string | null }) => {
        if (j.storeCode) {
          setMyStoreCode(j.storeCode);
          setDestinationStoreCode(j.storeCode);
        }
      })
      .catch(() => null);
  }, [isAdmin]);

  // Load inventory items
  useEffect(() => {
    apiFetch("/api/inventory")
      .then((r) => r.json())
      .then((j: { items: InventoryItem[] }) => setItems(j.items ?? []))
      .catch(() => setError("Could not load inventory items."))
      .finally(() => setLoadingItems(false));
  }, []);

  // Load per-store balances when item selected
  useEffect(() => {
    if (!itemId) { setLocationBalances([]); return; }
    fetch(`/api/inventory/location-stock?itemId=${itemId}`)
      .then((r) => r.json())
      .then((json: { locationStock?: Array<LocationBalance & { location?: { code: string; name: string } }> }) => {
        setLocationBalances(
          (json.locationStock ?? []).map((ls) => ({
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

  const getStoreBalance = (code: string) =>
    locationBalances.find((b) => b.locationCode === code)?.physicalQty ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!itemId) { setError("Select an inventory item."); return; }
    const qty = typeof quantity === "string" ? Number(quantity) : quantity;
    if (!Number.isFinite(qty) || qty <= 0) { setError("Quantity must be greater than 0."); return; }
    if (!sourceStoreCode || !destinationStoreCode) { setError("Select source and destination stores."); return; }
    if (sourceStoreCode === destinationStoreCode) { setError("Source and destination must differ."); return; }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/stock-transfers", {
        method: "POST",
        body: JSON.stringify({ sourceStoreCode, destinationStoreCode, notes: notes.trim() || undefined, items: [{ itemId, qtyRequested: qty }] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.message ?? "Failed to create request"); return; }
      navigate(ROUTES.INVENTORY_STOCK_TRANSFERS);
    } catch { setError("Network error while creating request."); }
    finally { setSubmitting(false); }
  };

  const selected = items.find((i) => i.id === itemId);
  const loading = loadingItems || loadingStores;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Go back" onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFERS)}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900">New stock request</h1>
          <p className="text-xs text-slate-500 mt-1">Creates a PENDING transfer for Main Store approval.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        {error && (
          <div className="flex gap-2 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg text-[10px] font-bold text-rose-600">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        )}

        {/* Item selector */}
        <div className="space-y-1">
          <label htmlFor="transfer-item" className="text-[9px] font-extrabold text-slate-400 uppercase">Item</label>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : (
            <select id="transfer-item" value={itemId} onChange={(e) => setItemId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400">
              <option value="">Select item</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>
              ))}
            </select>
          )}
        </div>

        {selected && (
          <p className="text-[10px] text-slate-500">
            Global on-hand: {selected.quantity.toFixed(3)} {selected.unit}
            {sourceStoreCode && getStoreBalance(sourceStoreCode) != null && (
              <> · At {sourceStoreCode}: <span className="font-mono font-bold text-emerald-700">{getStoreBalance(sourceStoreCode)!.toFixed(3)}</span></>
            )}
          </p>
        )}

        {/* Store selectors */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="source-store" className="text-[9px] font-extrabold text-slate-400 uppercase">From (source)</label>
            <select id="source-store" value={sourceStoreCode} onChange={(e) => setSourceStoreCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-1 focus:outline-none focus:border-orange-400">
              {stores.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="dest-store" className="text-[9px] font-extrabold text-slate-400 uppercase">
              To {!isAdmin && myStoreCode ? "(your store)" : "(destination)"}
            </label>
            <select id="dest-store" value={destinationStoreCode} onChange={(e) => setDestinationStoreCode(e.target.value)}
              disabled={!isAdmin && Boolean(myStoreCode)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-1 focus:outline-none focus:border-orange-400 disabled:opacity-60 disabled:cursor-not-allowed">
              {stores.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            {!isAdmin && myStoreCode && (
              <p className="text-[9px] text-slate-400">Locked to your assigned store</p>
            )}
          </div>
        </div>

        {/* Qty + notes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="transfer-qty" className="text-[9px] font-extrabold text-slate-400 uppercase">Quantity requested</label>
            <input id="transfer-qty" type="number" step="0.001" min="0" value={quantity} placeholder="0"
              onChange={(e) => { const v = e.target.value; setQuantity(v === "" ? "" : parseFloat(v)); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono mt-1 focus:outline-none focus:border-orange-400" />
          </div>
          <div className="space-y-1">
            <label htmlFor="transfer-notes" className="text-[9px] font-extrabold text-slate-400 uppercase">Notes</label>
            <input id="transfer-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs mt-1 focus:outline-none focus:border-orange-400" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFERS)}
            className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600">Cancel</button>
          <button type="submit" disabled={submitting || loading}
            className="px-4 py-2 rounded-lg bg-[#ff7d12] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
            Submit request
          </button>
        </div>
      </form>
    </div>
  );
}
