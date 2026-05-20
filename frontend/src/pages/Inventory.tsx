import React, { useState, useEffect } from "react";
import { Package, Search, Plus, Loader2, Info, Check, AlertCircle, RefreshCw } from "lucide-react";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  type: "RAW_MATERIAL" | "FINISHED_GOOD" | "BY_PRODUCT";
  unit: "KG" | "BAG";
  quantity: number;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

const MOCK_ITEMS: InventoryItem[] = [
  {
    id: "item_1",
    sku: "MZ-RAW-01",
    name: "Raw Maize Grain",
    description: "Bulk dry maize grain loaded in warehouse silos",
    type: "RAW_MATERIAL",
    unit: "KG",
    quantity: 4250.50,
    unitPrice: 0.45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item_2",
    sku: "FL-GR1-01",
    name: "Grade 1 Maize Flour",
    description: "Premium fine milled maize flour (domestic retail package ready)",
    type: "FINISHED_GOOD",
    unit: "KG",
    quantity: 1420.00,
    unitPrice: 1.20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item_3",
    sku: "FL-GR2-02",
    name: "Grade 2 Maize Flour",
    description: "Standard sifted flour for retail and commercial baking",
    type: "FINISHED_GOOD",
    unit: "KG",
    quantity: 840.50,
    unitPrice: 0.90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "item_4",
    sku: "BY-JAM-03",
    name: "Maize Jam",
    description: "Milling by-product (bran + germ blend), high protein livestock feed",
    type: "BY_PRODUCT",
    unit: "KG",
    quantity: 560.00,
    unitPrice: 0.30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>(MOCK_ITEMS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "offline">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);

  // Form State
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"RAW_MATERIAL" | "FINISHED_GOOD" | "BY_PRODUCT">("FINISHED_GOOD");
  const [unit, setUnit] = useState<"KG" | "BAG">("KG");
  const [quantity, setQuantity] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0.0);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/inventory");
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.items)) {
          setItems(data.items.length > 0 ? data.items : MOCK_ITEMS);
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

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name || unitPrice <= 0) {
      setErrorText("SKU, Name, and Unit Price are required fields.");
      return;
    }

    const payload = {
      sku,
      name,
      description: description || undefined,
      type,
      unit,
      quantity,
      unitPrice,
    };

    setErrorText(null);

    if (apiStatus === "connected") {
      try {
        const response = await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          const data = await response.json();
          if (data && data.item) {
            setItems((prev) => [data.item, ...prev]);
            closeModal();
          } else {
            setErrorText("Failed to process creation response.");
          }
        } else {
          const err = await response.json();
          setErrorText(err.message || "Failed to create item in database.");
        }
      } catch (e) {
        setErrorText("Network request failed. Database operation failed.");
      }
    } else {
      // Simulate locally
      const mockNew: InventoryItem = {
        id: `local_${Date.now()}`,
        sku,
        name,
        description: description || null,
        type,
        unit,
        quantity,
        unitPrice,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setItems((prev) => [mockNew, ...prev]);
      closeModal();
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSku("");
    setName("");
    setDescription("");
    setType("FINISHED_GOOD");
    setUnit("KG");
    setQuantity(0);
    setUnitPrice(0.0);
    setErrorText(null);
  };

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getTypeBadge = (itemType: string) => {
    switch (itemType) {
      case "RAW_MATERIAL":
        return (
          <span className="inline-block text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-lg select-none">
            Raw Material
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
          <span className="inline-block text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-lg select-none">
            Finished Good
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock & Assets Catalog</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Trace raw maize warehouses, milled flour products, and commercial by-products.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          {apiStatus === "connected" ? (
            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm">
              <Check className="h-3.5 w-3.5" /> Database Live
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-750 border border-amber-200/60 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm" title="Using local mock storage">
              <Info className="h-3.5 w-3.5" /> Demo Sandbox
            </div>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#ff8621] hover:bg-[#ffc08c] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 active:scale-95"
          >
            <Plus className="h-4 w-4" /> Add Catalog Item
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-indigo-655 transition-colors" />
          <input
            type="text"
            placeholder="Search items by SKU, Name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-55 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-all text-slate-800"
          />
        </div>
        
        <button 
          onClick={fetchInventory}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-655 hover:bg-slate-50 transition-colors shadow-sm bg-white"
          title="Refresh Catalog Data"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl h-64 flex items-center justify-center shadow-sm">
          <div className="flex items-center gap-2.5 text-slate-500 text-xs font-semibold">
            <Loader2 className="h-4.5 w-4.5 animate-spin text-indigo-600" />
            Synchronizing catalog...
          </div>
        </div>
      ) : (
        /* Inventory Table */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-extrabold tracking-widest uppercase">
                  <th className="px-6 py-4.5">SKU Code</th>
                  <th className="px-6 py-4.5">Product Type</th>
                  <th className="px-6 py-4.5">Item Name & Details</th>
                  <th className="px-6 py-4.5 text-right">Quantity In Stock</th>
                  <th className="px-6 py-4.5 text-right">Unit Price</th>
                  <th className="px-6 py-4.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No stock catalog listings found matching the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLowStock = item.quantity <= (item.type === "RAW_MATERIAL" ? 500 : 100);
                    const isOutOfStock = item.quantity === 0;
                    
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4.5 font-mono text-indigo-650 font-bold select-all">
                          {item.sku}
                        </td>
                        <td className="px-6 py-4.5">
                          {getTypeBadge(item.type)}
                        </td>
                        <td className="px-6 py-4.5 max-w-xs">
                          <div className="font-bold text-slate-850">{item.name}</div>
                          <div className="text-slate-450 text-[10px] truncate mt-0.5" title={item.description || ""}>
                            {item.description || "No description provided"}
                          </div>
                        </td>
                        <td className="px-6 py-4.5 text-right font-extrabold font-mono text-slate-900">
                          {item.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} <span className="text-[10px] text-slate-450 font-sans font-bold">{item.unit}</span>
                        </td>
                        <td className="px-6 py-4.5 text-right font-mono font-bold text-slate-700">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          {isOutOfStock ? (
                            <span className="inline-block text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200/50 px-2 py-0.5 rounded-lg select-none">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-block text-[9px] font-black bg-amber-50 text-amber-750 border border-amber-200/50 px-2 py-0.5 rounded-lg select-none" title="Stock alert trigger threshold exceeded">
                              Reorder Alert
                            </span>
                          ) : (
                            <span className="inline-block text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-lg select-none">
                              Sufficient
                            </span>
                          )}
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

      {/* Add Item Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-650 flex items-center justify-center">
                <Package className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Publish Catalog Item</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Record a physical product specification line.</p>
              </div>
            </div>

            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              {errorText && (
                <div className="flex gap-2 bg-rose-50 border border-rose-100 p-3 rounded-lg text-[10px] text-rose-600 font-bold">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorText}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase">SKU Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MZ-RAW-01"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase">Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raw Maize"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase">Catalog Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800"
                  >
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="FINISHED_GOOD">Finished Good</option>
                    <option value="BY_PRODUCT">By-Product</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase">Unit of Measure</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-bold"
                  >
                    <option value="KG">Kilograms (KG)</option>
                    <option value="BAG">Bags (BAG)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-450 uppercase">Description</label>
                <textarea
                  placeholder="Specifications, warehouse locator bin, moisture target..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 resize-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase">Opening Balance Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0.0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-extrabold text-slate-450 uppercase">Selling Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0.0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:border-indigo-500 text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-655 px-6 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#ff7d12] hover:bg-[#ffc28f] text-white px-6 py-2 rounded-lg text-xs font-bold shadow-md shadow-indigo-600/10 active:scale-95 transition-all"
                >
                  Publish Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
