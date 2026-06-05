/**
 * BaleTransferForm
 *
 * Shared form for both:
 *  - Push Transfer  (/bale-transfers/push) — Packaging Manager sends bales directly
 *  - Pull Request   (/bale-transfers/pull) — Dispatch Manager requests bales
 *
 * Mode is determined by the URL path.
 * Items are loaded from /api/bale-transfers/bale-stock — only items that have
 * been produced as packed bales in completed packaging runs, so raw packaging
 * materials (empty bags, tape, glue) never appear here.
 */
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  ArrowUpFromLine,
  ArrowDownToLine,
  Package,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { apiFetch } from "../../api/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type BaleStockItem = {
  inventoryItemId: string;
  sku: string;
  name: string;
  unit: string;      // always "BALES"
  type: string;
  typeKey: string;
  physicalQty: number;  // available bales
  transitQty: number;   // bales already in transit
};

type LineItem = {
  key: number;
  inventoryItemId: string;
  qtyRequested: number | "";
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BaleTransferForm() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isPush = pathname.endsWith("/push");

  const [items, setItems] = useState<BaleStockItem[]>([]);
  const [selectedLineLabel, setSelectedLineLabel] = useState<string>("");
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<LineItem[]>([
    { key: Date.now(), inventoryItemId: "", qtyRequested: "" },
  ]);

  // Load only packed-bale items (items produced in packaging runs)
  useEffect(() => {
    apiFetch("/api/bale-transfers/bale-stock")
      .then((r) => r.json())
      .then((j: { stock: BaleStockItem[] }) => {
        setItems(j.stock ?? []);
      })
      .catch(() => setError("Could not load bale stock."))
      .finally(() => setLoadingItems(false));
  }, []);

  // ── line helpers ────────────────────────────────────────────────────────────

  const addLine = () =>
    setLines((prev) => [...prev, { key: Date.now(), inventoryItemId: "", qtyRequested: "" }]);

  const removeLine = (key: number) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const updateLine = (key: number, patch: Partial<Omit<LineItem, "key">>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Prevent the same item appearing on two lines
  const usedIds = new Set(lines.map((l) => l.inventoryItemId).filter(Boolean));
  const availableFor = (key: number) => {
    const own = lines.find((l) => l.key === key)?.inventoryItemId ?? "";
    return items.filter((it) => it.inventoryItemId === own || !usedIds.has(it.inventoryItemId));
  };

  // ── submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validLines = lines.filter((l) => l.inventoryItemId);
    if (validLines.length === 0) {
      setError("Add at least one bale item.");
      return;
    }
    for (const l of validLines) {
      const qty = typeof l.qtyRequested === "number" ? l.qtyRequested : 0;
      if (qty <= 0) {
        const it = items.find((i) => i.inventoryItemId === l.inventoryItemId);
        setError(`Quantity for "${it?.name ?? l.inventoryItemId}" must be greater than zero.`);
        return;
      }
    }

    const endpoint = isPush ? "/api/bale-transfers/push" : "/api/bale-transfers/pull";

    setSubmitting(true);
    try {
      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          items: validLines.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            qtyRequested: typeof l.qtyRequested === "number" ? l.qtyRequested : 0,
          })),
          notes: notes.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.message ?? "Failed to create transfer");
        return;
      }
      navigate(ROUTES.INVENTORY_BALE_TRANSFERS);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  const Icon = isPush ? ArrowUpFromLine : ArrowDownToLine;
  const title = isPush ? "Push Bales to Dispatch" : "Request Bales from Packaging";
  const subtitle = isPush
    ? "Moves bales immediately into transit toward Dispatch Store."
    : "Creates a pending request for Packaging Store to review and issue.";
  const buttonLabel = isPush ? "Push bales" : "Submit request";
  const buttonClass = isPush
    ? "bg-emerald-600 hover:bg-emerald-700"
    : "bg-[#ff7d12] hover:bg-orange-600";

  const noItemsYet = !loadingItems && items.length === 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS)}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5"
      >
        {error && (
          <div className="flex gap-2 items-start bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 text-xs font-bold text-rose-600">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Route indicator */}
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          <span className="font-bold">Packaging Store</span>
          <span className="text-slate-400">→</span>
          <span className="font-bold">Dispatch Store</span>
        </div>

        {/* No bales available yet */}
        {noItemsYet && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">No packed bales in Packaging Store yet</p>
            <p className="text-xs text-slate-400">
              Complete a packaging run first so bales appear here.
            </p>
          </div>
        )}

        {/* Line items */}
        {!noItemsYet && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                Bale Items
              </p>
              <button
                type="button"
                onClick={addLine}
                disabled={loadingItems || lines.length >= items.length}
                className="flex items-center gap-1 text-[10px] font-bold text-orange-600 hover:text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </button>
            </div>

            {loadingItems ? (
              <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading bale stock…
              </div>
            ) : (
              lines.map((line, idx) => {
                const chosen = items.find((it) => it.inventoryItemId === line.inventoryItemId);
                const available = availableFor(line.key);
                const isOverStock =
                  chosen &&
                  typeof line.qtyRequested === "number" &&
                  line.qtyRequested > chosen.physicalQty;

                return (
                  <div
                    key={line.key}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-start bg-slate-50 border border-slate-200 rounded-xl p-3"
                  >
                    {/* Item selector */}
                    <div className="space-y-1">
                      <label
                        htmlFor={`item-${line.key}`}
                        className="text-[9px] font-extrabold text-slate-400 uppercase"
                      >
                        Item {idx + 1}
                      </label>
                      <select
                        id={`item-${line.key}`}
                        value={line.inventoryItemId}
                        onChange={(e) => updateLine(line.key, { inventoryItemId: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400"
                      >
                        <option value="">Select bale type…</option>
                        {available.map((it) => (
                          <option key={it.inventoryItemId} value={it.inventoryItemId}>
                            {it.name} ({it.sku}) — {it.physicalQty} {it.physicalQty === 1 ? "bale" : "bales"} available
                          </option>
                        ))}
                      </select>

                      {/* Stock info */}
                      {chosen && (
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-[10px] text-slate-500">
                            Available:{" "}
                            <span
                              className={`font-mono font-bold ${
                                chosen.physicalQty > 0 ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              {chosen.physicalQty}
                            </span>{" "}
                            {chosen.physicalQty === 1 ? "bale" : "bales"}
                          </p>
                          {chosen.transitQty > 0 && (
                            <p className="text-[10px] text-blue-600">
                              {chosen.transitQty} {chosen.transitQty === 1 ? "bale" : "bales"} in transit
                            </p>
                          )}
                        </div>
                      )}

                      {isOverStock && (
                        <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Exceeds available bales ({chosen!.physicalQty} {chosen!.physicalQty === 1 ? "bale" : "bales"})
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="space-y-1 w-28">
                      <label
                        htmlFor={`qty-${line.key}`}
                        className="text-[9px] font-extrabold text-slate-400 uppercase"
                      >
                        Qty
                      </label>
                      <input
                        id={`qty-${line.key}`}
                        type="number"
                        step="1"
                        min="1"
                        max={chosen?.physicalQty}
                        placeholder="0"
                        value={line.qtyRequested}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateLine(line.key, {
                            qtyRequested: v === "" ? "" : parseFloat(v),
                          });
                        }}
                        className={`w-full bg-white border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400 ${
                          isOverStock ? "border-rose-300" : "border-slate-200"
                        }`}
                      />
                      {chosen && (
                        <p className="text-[9px] text-slate-400 text-center">bales</p>
                      )}
                    </div>

                    {/* Remove */}
                    <div className="pt-5">
                      <button
                        type="button"
                        disabled={lines.length === 1}
                        onClick={() => removeLine(line.key)}
                        aria-label="Remove item"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1">
          <label htmlFor="notes" className="text-[9px] font-extrabold text-slate-400 uppercase">
            Notes <span className="font-normal text-slate-300">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isPush
                ? "e.g. End-of-day push — mixed bale types"
                : "e.g. Needed for morning dispatch run"
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-orange-400"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS)}
            className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || loadingItems || noItemsYet}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-60 transition-colors ${buttonClass}`}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {submitting ? "Submitting…" : buttonLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
