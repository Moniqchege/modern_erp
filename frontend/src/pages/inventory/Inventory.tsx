import React, { useState, useEffect, useCallback } from "react";
import {
  Package, Search, Plus, Loader2, Info, Check,
  AlertCircle, RefreshCw, Pencil, Eye, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../app/router/routes";
import { getCurrentUser } from "../../auth/authClient";
import { apiFetch } from "../../api/apiClient";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  type:
    | "RAW_MATERIAL"
    | "FINISHED_GOOD"
    | "BY_PRODUCT"
    | "PACKETS_2KG"
    | "PACKETS_1KG"
    | "KHAKI_BALER_2KG"
    | "KHAKI_BALER_1KG"
    | "NYLON_BALER_1KG"
    | "NYLON_BALER_2KG"
    | "BAG_5KG"
    | "BAG_10KG"
    | "LAMINATED_BALER"
    | "BAG_50KG"
    | "BAG_90KG"
    | "CLEAR_TAPES"
    | "GLUE";
  unit: string;
  store?: string;
  quantity: number;
  unitPrice?: number | null;
  reorderLevel?: number | null;
  reorderQuantity?: number | null;
  createdAt: string;
  updatedAt: string;
}

const BUYING_PRICE_TYPES: ReadonlySet<InventoryItem["type"]> = new Set([
  "RAW_MATERIAL",
  "PACKETS_2KG",
  "PACKETS_1KG",
  "KHAKI_BALER_2KG",
  "KHAKI_BALER_1KG",
  "NYLON_BALER_1KG",
  "NYLON_BALER_2KG",
  "LAMINATED_BALER",
  "BAG_5KG",
  "BAG_10KG",
  "BAG_50KG",
  "BAG_90KG",
  "CLEAR_TAPES",
  "GLUE",
]);

const CATALOG_TYPE_OPTIONS: Array<{
  value: InventoryItem["type"];
  label: string;
}> = [
  { value: "RAW_MATERIAL", label: "Raw Material" },
  { value: "FINISHED_GOOD", label: "Finished Good" },
  { value: "BY_PRODUCT", label: "By-Product" },
  { value: "PACKETS_2KG", label: "2kg Packets" },
  { value: "PACKETS_1KG", label: "1kg Packets" },
  { value: "KHAKI_BALER_2KG", label: "2kg Khaki Baler" },
  { value: "KHAKI_BALER_1KG", label: "1kg Khaki Baler" },
  { value: "NYLON_BALER_1KG", label: "1kg Nylon Baler" },
  { value: "NYLON_BALER_2KG", label: "2kg Nylon Baler" },
  { value: "LAMINATED_BALER", label: "Laminated Baler" },
  { value: "BAG_5KG", label: "5kg Bag" },
  { value: "BAG_10KG", label: "10kg Bag" },
  { value: "BAG_50KG", label: "50kg Bag" },
  { value: "BAG_90KG", label: "90kg Bag" },
  { value: "CLEAR_TAPES", label: "Clear Tapes" },
  { value: "GLUE", label: "Glue" },
];

function getPriceLabel(type: InventoryItem["type"]): string {
  return BUYING_PRICE_TYPES.has(type)
    ? "Buying Unit Price (ksh)"
    : "Selling Unit Price (ksh)";
}

function isBelowReorder(item: InventoryItem): boolean {
  if (item.reorderLevel == null) return false;
  return item.quantity <= item.reorderLevel;
}


// ─── Props ────────────────────────────────────────────────────────────────────

interface InventoryProps {
  onViewItem?: (itemId: string) => void;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeBadge(itemType: string) {
  switch (itemType) {
    case "RAW_MATERIAL":
      return (
        <span className="inline-block text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-lg select-none">
          Raw Material
        </span>
      );
    case "FINISHED_GOOD":
      return (
        <span className="inline-block text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-lg select-none">
          Finished Good
        </span>
      );
    case "BY_PRODUCT":
      return (
        <span className="inline-block text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/50 px-2 py-0.5 rounded-lg select-none">
          By-Product
        </span>
      );
    default:
      return (
        <span className="inline-block text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/50 px-2 py-0.5 rounded-lg select-none">
          {itemType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())}
        </span>
      );
  }
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  item: InventoryItem;
  apiConnected: boolean;
  onClose: () => void;
  onSaved: (updated: InventoryItem) => void;
}

function EditModal({ item, apiConnected, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [unitPrice, setUnitPrice] = useState<number>(item.unitPrice ?? 0);
  const [reorderLevel, setReorderLevel] = useState<string>(
    item.reorderLevel != null ? String(item.reorderLevel) : ""
  );
  const [reorderQuantity, setReorderQuantity] = useState<string>(
    item.reorderQuantity != null ? String(item.reorderQuantity) : ""
  );
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const quantityChanged = quantity !== item.quantity;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrorText("Name is required."); return; }
    setErrorText(null);
    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      quantity,
      unitPrice,
      reorderLevel: reorderLevel.trim() === "" ? null : parseFloat(reorderLevel),
      reorderQuantity: reorderQuantity.trim() === "" ? null : parseFloat(reorderQuantity),
      ...(quantityChanged && adjustmentNote ? { adjustmentNote } : {}),
    };

    if (apiConnected) {
      try {
        const res = await apiFetch(`/api/inventory/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          setErrorText(err.message ?? "Update failed.");
          setSaving(false);
          return;
        }
        const data = await res.json();
        onSaved(data.item);
      } catch {
        setErrorText("Network error. Could not save.");
        setSaving(false);
      }
    } else {
      onSaved({
        ...item,
        name: payload.name,
        description: payload.description,
        quantity: payload.quantity,
        unitPrice: payload.unitPrice,
        reorderLevel: payload.reorderLevel,
        reorderQuantity: payload.reorderQuantity,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Edit Item</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {errorText && (
            <div className="flex gap-2 bg-rose-50 border border-rose-100 p-3 rounded-lg text-[10px] text-rose-600 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Product Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Product description…"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 resize-none focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>

          {/* Quantity + Unit Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                Quantity ({item.unit})
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                {getPriceLabel(item.type)}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                Reorder level ({item.unit}) <span className="text-slate-300 font-normal">optional</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Alert when at or below"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                Reorder qty <span className="text-slate-300 font-normal">optional</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>

          {/* Adjustment note — shown only if quantity changed */}
          {quantityChanged && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                Adjustment Reason <span className="text-slate-300">(optional)</span>
              </label>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[10px] text-amber-700 font-medium mb-1.5">
                Quantity will change by{" "}
                <strong>
                  {quantity - item.quantity > 0 ? "+" : ""}
                  {(quantity - item.quantity).toFixed(3)} {item.unit}
                </strong>
                . A movement record will be created.
              </div>
              <input
                type="text"
                placeholder="e.g. Stock recount, spoilage write-off…"
                value={adjustmentNote}
                onChange={(e) => setAdjustmentNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
              />
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#ff7d12] hover:bg-[#ffa04e] disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Inventory Component ──────────────────────────────────────────────────

export function Inventory({ onViewItem }: InventoryProps) {
  const user = getCurrentUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "offline">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  // My store (non-admin)
  const [myStoreCode, setMyStoreCode] = useState<string | null | undefined>(undefined);
  const [myStoreName, setMyStoreName] = useState<string | null>(null);

  // Add-form state
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<InventoryItem["type"] | "">("");

  const [store, setStore] = useState("MAIN_STORE");
  const [unit, setUnit] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [reorderLevel, setReorderLevel] = useState<string>("");
  const [reorderQuantity, setReorderQuantity] = useState<string>("");

  const [typeQuery, setTypeQuery] = useState("");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const isTypeSelected = (t: InventoryItem["type"] | ""): t is InventoryItem["type"] =>
  t !== "";

  const UNIT_OPTIONS = [
  "KG",
  "PIECES",
  "BAG",
  "BALE",
  "GRAMS",
  "L",
  "MT",
  "UNIT",
];

const [showUnitDropdown, setShowUnitDropdown] = useState(false);

const filteredUnits =
  unit.trim() === ""
    ? UNIT_OPTIONS
    : UNIT_OPTIONS.filter((u) =>
        u.toLowerCase().includes(unit.toLowerCase())
      );

      const filteredTypes = typeQuery.trim()
  ? CATALOG_TYPE_OPTIONS.filter((t) =>
      t.label.toLowerCase().includes(typeQuery.toLowerCase()) ||
      t.value.toLowerCase().includes(typeQuery.toLowerCase())
    )
  : CATALOG_TYPE_OPTIONS;

  const navigate = useNavigate();

  // Resolve non-admin store code once
  useEffect(() => {
    if (isAdmin) { setMyStoreCode(null); return; }
    apiFetch("/api/stores/me")
      .then((r) => r.json())
      .then((j: { storeCode: string | null; store?: { name: string } | null }) => {
        setMyStoreCode(j.storeCode);
        setMyStoreName(j.store?.name ?? null);
      })
      .catch(() => setMyStoreCode(null));
  }, [isAdmin]);

  const fetchInventory = useCallback(async (storeCode?: string | null) => {
    setLoading(true);
    try {
      const qs = storeCode ? `?storeCode=${encodeURIComponent(storeCode)}` : "";
      const response = await apiFetch(`/api/inventory${qs}`);
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.items)) {
          setItems(data.items);
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

  // Fetch once store code is resolved
  useEffect(() => {
    if (myStoreCode === undefined && !isAdmin) return; // still loading
    void fetchInventory(isAdmin ? null : myStoreCode);
  }, [myStoreCode, isAdmin, fetchInventory]);

  useEffect(() => {
  setTypeQuery(
    CATALOG_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? ""
  );
}, [type]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name || !type) {
  setErrorText("SKU, Name, and Catalog Type are required.");
  return;
}
    const payload = {
      sku,
      name,
      description: description || undefined,
      type,
      store,
      unit: unit || "KG",
      quantity: quantity === "" ? 0 : quantity,
      unitPrice: unitPrice === "" ? 0 : unitPrice,
      reorderLevel: reorderLevel.trim() === "" ? null : parseFloat(reorderLevel),
      reorderQuantity: reorderQuantity.trim() === "" ? null : parseFloat(reorderQuantity),
    };
    setErrorText(null);

    if (apiStatus === "connected") {
      try {
        const res = await apiFetch("/api/inventory", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.item) { setItems((prev) => {
  const safePrev = prev ?? [];
  return [data.item, ...safePrev];
}); closeAddModal(); }
          else setErrorText("Failed to parse server response.");
        } else {
          const err = await res.json();
          setErrorText(err.message ?? "Failed to create item.");
        }
      } catch { setErrorText("Network error."); }
    } else {
      setItems((p) => [{
        id: `local_${Date.now()}`, sku, name,
        description: description || null, type, store, unit, quantity: quantity === "" ? 0 : quantity, unitPrice: unitPrice === "" ? 0 : unitPrice,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }, ...p]);
      closeAddModal();
    }
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setSku(""); setName(""); setDescription(""); setType("FINISHED_GOOD");
    setStore("MAIN_STORE"); setUnit("KG"); setQuantity(""); setUnitPrice("");
    setReorderLevel(""); setReorderQuantity(""); setErrorText(null);
  };

  const handleEditSaved = (updated: InventoryItem) => {
  setItems((prev) => {
    const safePrev = prev ?? [];
    return safePrev.map((it) =>
      it.id === updated.id ? updated : it
    );
  });
  setEditTarget(null);
};

  const filteredItems = (items ?? []).filter((item) =>
  item.name.toLowerCase().includes(search.toLowerCase()) ||
  item.sku.toLowerCase().includes(search.toLowerCase()) ||
  item.description?.toLowerCase().includes(search.toLowerCase())
);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* ── Title Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {myStoreName ? `${myStoreName} — Stock Catalogue` : "Stock & Assets Catalog"}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {myStoreName
              ? `Items with stock in your store (${myStoreName}).`
              : "Trace raw maize warehouses, milled flour products, and commercial by-products."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {apiStatus === "connected" ? (
            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm">
              <Check className="h-3.5 w-3.5" /> Database Live
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/60 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm">
              <Info className="h-3.5 w-3.5" /> Demo Sandbox
            </div>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-[#ff8621] hover:bg-[#ffa04e] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            <Plus className="h-4 w-4" /> Add Catalog Item
          </button>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search items by SKU, Name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-all text-slate-800"
          />
        </div>
        <button
          onClick={() => fetchInventory(isAdmin ? null : myStoreCode)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm bg-white"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl h-64 flex items-center justify-center shadow-sm">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            Synchronizing catalog...
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-extrabold tracking-widest uppercase">
                  <th className="px-6 py-4">SKU Code</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Item Name & Details</th>
                  <th className="px-6 py-4">Qty In Stock</th>
                  <th className="px-6 py-4 truncate">Unit Price</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No items found matching the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLowStock = isBelowReorder(item);
                    const isOutOfStock = item.quantity === 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/40 transition-colors py-4">
                        <td className="px-6 py-4 font-mono text-[#000] truncate font-bold select-all">{item.sku}</td>
                        <td className="truncate">{getTypeBadge(item.type)}</td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <div className="text-slate-400 text-[10px] truncate mt-0.5" title={item.description ?? ""}>
                            {item.description ?? "No description provided"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-left font-extrabold truncate font-mono text-slate-900">
                          {item.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}{" "}
                          <span className="text-[10px] text-slate-400 font-sans font-bold">{item.unit}</span>
                        </td>
                        <td className="px-6 py-4 text-left font-mono truncate font-bold text-slate-700">
                          {item.unitPrice != null ? `ksh ${item.unitPrice.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isOutOfStock ? (
                            <span className="inline-block text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200/50 px-2 py-0.5 rounded-lg select-none">Out of Stock</span>
                          ) : isLowStock ? (
                            <span className="inline-block text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-lg select-none">Reorder Alert</span>
                          ) : (
                            <span className="inline-block text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-lg select-none">Sufficient</span>
                          )}
                        </td>

                        {/* ── Action buttons ── */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* View */}
                            <button
                              title="View item details"
                              onClick={() => navigate(ROUTES.INVENTORY_DETAIL(item.id))}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-all active:scale-95"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </button>

                            {/* Edit */}
                            <button
                              title="Edit item"
                              onClick={() => setEditTarget(item)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-300 text-[10px] font-bold text-slate-500 hover:text-orange-600 transition-all active:scale-95"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Item Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Publish Catalog Item</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Record a physical product specification line.</p>
                </div>
              </div>
              <button onClick={closeAddModal} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-4 overflow-y-auto flex-1">
              {errorText && (
                <div className="flex gap-2 bg-rose-50 border border-rose-100 p-3 rounded-lg text-[10px] text-rose-600 font-bold">
                  <AlertCircle className="h-4 w-4 shrink-0" />{errorText}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase">SKU Code</label>
                  <input type="text" required placeholder="e.g. MZ-RAW-01" value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-mono uppercase" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase">Product Name</label>
                  <input type="text" required placeholder="e.g. Raw Maize" value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1 relative">
  <label className="text-[9px] font-extrabold text-slate-400 uppercase">
    Catalog Type
  </label>

  <input
    type="text"
    value={typeQuery}
    onFocus={() => setShowTypeDropdown(true)}
    onChange={(e) => {
      setTypeQuery(e.target.value);
      setShowTypeDropdown(true);
    }}
    onBlur={() => setTimeout(() => setShowTypeDropdown(false), 150)}
    placeholder="Search catalog type..."
    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-medium"
  />

  {showTypeDropdown && (
    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
      {filteredTypes.length > 0 ? (
        filteredTypes.map((t) => (
          <button
            key={t.value}
            type="button"
            onMouseDown={() => {
              setType(t.value);       
              setTypeQuery(t.label);  
              setShowTypeDropdown(false);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 text-slate-700 font-medium"
          >
            {t.label}
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-xs text-slate-400">
          No matching catalog types
        </div>
      )}
    </div>
  )}
</div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase">Destination Store</label>
                  <select value={store} onChange={(e) => setStore(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-800">
                    <option value="MAIN_STORE">Main Store</option>
                    <option value="MAIZE_STORE">Maize Store</option>
                    <option value="PACKAGING_STORE">Packaging Store</option>
                    <option value="DISPATCH_STORE">Dispatch Store</option>
                  </select>
                </div>
              </div>

             <div className="space-y-1 relative">
  <label className="text-[9px] font-extrabold text-slate-400 uppercase">
    Unit of Measure
  </label>

  <input
    type="text"
    value={unit}
    onFocus={() => setShowUnitDropdown(true)}
    onChange={(e) => {
      setUnit(e.target.value.toUpperCase());
      setShowUnitDropdown(true);
    }}
    onBlur={() => {
      setTimeout(() => setShowUnitDropdown(false), 150);
    }}
    placeholder="Search or type unit (KG, BAG...)"
    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-bold"
  />

  {showUnitDropdown && (
    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
      {filteredUnits.length > 0 ? (
        filteredUnits.map((u) => (
          <button
            key={u}
            type="button"
            onMouseDown={() => {
              setUnit(u);
              setShowUnitDropdown(false);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 text-slate-700 font-medium"
          >
            {u}
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-xs text-slate-400">
          No matching units
        </div>
      )}
    </div>
  )}
</div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase">Description</label>
                <textarea placeholder="Specifications, warehouse locator bin, moisture target..." value={description}
                  onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 resize-none font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-4">
  <div className="space-y-1">
    <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
      Quantity ({unit})
    </label>

    <input
      type="number"
      step="0.001"
      min="0"
      placeholder="0"
      value={quantity}
      onChange={(e) =>
        setQuantity(
          e.target.value === ""
            ? ""
            : parseFloat(e.target.value)
        )
      }
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
    />
  </div>

  <div className="space-y-1">
    <label className="text-[9px] font-extrabold text-slate-400 uppercase">
      {isTypeSelected(type)
        ? getPriceLabel(type)
        : "Unit Price (ksh)"}
    </label>

    <input
      type="number"
      step="0.01"
      min="0"
      placeholder="0.00"
      value={unitPrice}
      onChange={(e) =>
        setUnitPrice(
          e.target.value === ""
            ? ""
            : parseFloat(e.target.value)
        )
      }
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-800 font-mono"
    />
  </div>
</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase">Reorder level (optional)</label>
                  <input type="number" step="0.01" min="0" placeholder="Email alert threshold"
                    value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-400 uppercase">Reorder qty (optional)</label>
                  <input type="number" step="0.01" min="0" value={reorderQuantity}
                    onChange={(e) => setReorderQuantity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-2.5 sticky bottom-0 bg-white pb-1">
                <button type="button" onClick={closeAddModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-2 rounded-lg text-xs font-bold transition-all active:scale-95">
                  Cancel
                </button>
                <button type="submit"
                  className="bg-[#ff7d12] hover:bg-[#ffa04e] text-white px-6 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all">
                  Publish Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <EditModal
          item={editTarget}
          apiConnected={apiStatus === "connected"}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}