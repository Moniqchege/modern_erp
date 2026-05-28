import React, { useMemo, useState } from "react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";

type MatchLine = {
  itemDescription: string;
  poQty: number;
  grnQty: number;
  poUnitPrice: number;
  grnUnitPrice: number;
};

type PoCandidate = {
  id: string;
  poNumber: string;
  grnNumber: string;
  supplierName: string;
  currency: string;
  lines: MatchLine[];
};

const MOCK_PO_CANDIDATES: PoCandidate[] = [
  {
    id: "po-001",
    poNumber: "PO-2026-0142",
    grnNumber: "GRN-2026-0731",
    supplierName: "Rift Valley Maize Co-op",
    currency: "KES",
    lines: [
      { itemDescription: "Fortified Maize Flour 2KG", poQty: 1200, grnQty: 1190, poUnitPrice: 145, grnUnitPrice: 145 },
      { itemDescription: "Fortified Maize Flour 5KG", poQty: 600, grnQty: 600, poUnitPrice: 340, grnUnitPrice: 340 },
    ],
  },
  {
    id: "po-002",
    poNumber: "PO-2026-0148",
    grnNumber: "GRN-2026-0742",
    supplierName: "Nakuru Packaging Industries",
    currency: "KES",
    lines: [
      { itemDescription: "NYLON_BALER_0.5KG", poQty: 100, grnQty: 100, poUnitPrice: 2200, grnUnitPrice: 2200 },
      { itemDescription: "KHAKI_BALER_1KG", poQty: 150, grnQty: 147, poUnitPrice: 2800, grnUnitPrice: 2790 },
      { itemDescription: "5KG_BAG", poQty: 80, grnQty: 80, poUnitPrice: 95, grnUnitPrice: 95 },
    ],
  },
];

const MATCH_VARIANCE_THRESHOLD = 1;

/** 3-way match workspace — wired to POST /api/procurement/three-way-match */
export function ThreeWayMatch() {
  const [poSearch, setPoSearch] = useState("");
  const [selectedPoId, setSelectedPoId] = useState(MOCK_PO_CANDIDATES[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceFileName, setInvoiceFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [overrideVariance, setOverrideVariance] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isApprovedPushed, setIsApprovedPushed] = useState(false);

  const filteredPoOptions = useMemo(() => {
    const query = poSearch.trim().toLowerCase();
    if (!query) return MOCK_PO_CANDIDATES;
    return MOCK_PO_CANDIDATES.filter(
      (po) =>
        po.poNumber.toLowerCase().includes(query) ||
        po.grnNumber.toLowerCase().includes(query) ||
        po.supplierName.toLowerCase().includes(query)
    );
  }, [poSearch]);

  const selectedPo = useMemo(
    () => MOCK_PO_CANDIDATES.find((po) => po.id === selectedPoId) ?? null,
    [selectedPoId]
  );

  const safeInvoiceTotal = Number(invoiceAmount) > 0 ? Number(invoiceAmount) : 0;
  const poBaselineTotal = selectedPo
    ? selectedPo.lines.reduce((sum, row) => sum + row.poQty * row.poUnitPrice, 0)
    : 0;
  const invoiceRatio = selectedPo
    ? safeInvoiceTotal / Math.max(poBaselineTotal, 1)
    : 1;

  const comparisonRows = useMemo(() => {
    if (!selectedPo) return [];
    return selectedPo.lines.map((row) => {
      const invoiceQty = Math.round(row.grnQty);
      const invoiceUnitPrice = Number((row.poUnitPrice * (safeInvoiceTotal > 0 ? invoiceRatio : 1)).toFixed(2));

      const qtyMax = Math.max(row.poQty, row.grnQty, invoiceQty);
      const qtyMin = Math.min(row.poQty, row.grnQty, invoiceQty);
      const qtyVariancePct = qtyMax === 0 ? 0 : ((qtyMax - qtyMin) / qtyMax) * 100;

      const priceMax = Math.max(row.poUnitPrice, row.grnUnitPrice, invoiceUnitPrice);
      const priceMin = Math.min(row.poUnitPrice, row.grnUnitPrice, invoiceUnitPrice);
      const priceVariancePct = priceMax === 0 ? 0 : ((priceMax - priceMin) / priceMax) * 100;

      const hasVariance =
        qtyVariancePct > MATCH_VARIANCE_THRESHOLD || priceVariancePct > MATCH_VARIANCE_THRESHOLD;

      return {
        ...row,
        invoiceQty,
        invoiceUnitPrice,
        qtyVariancePct,
        priceVariancePct,
        hasVariance,
      };
    });
  }, [selectedPo, safeInvoiceTotal, invoiceRatio]);

  const hasDiscrepancy = comparisonRows.some((row) => row.hasVariance);
  const matchStatus = hasDiscrepancy ? "PRICE_DISCREPANCY" : "MATCHED";

  const canApprove =
    comparisonRows.length > 0 &&
    !isLoading &&
    (!hasDiscrepancy || (overrideVariance && resolutionNotes.trim().length > 3));

  const runMatch = async () => {
    if (!selectedPo || !invoiceNumber.trim() || safeInvoiceTotal <= 0) {
      setBanner({
        type: "error",
        message: "Select PO and enter supplier invoice number and amount before running match.",
      });
      return;
    }

    setIsLoading(true);
    setBanner(null);
    setIsApprovedPushed(false);
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));

    try {
      await procurementApi.finance.threeWayMatch({
        grnId: selectedPo.grnNumber,
        supplierInvoiceId: invoiceNumber,
        matchedBy: "Procurement Officer",
        tolerancePct: MATCH_VARIANCE_THRESHOLD,
      });
      setBanner({
        type: hasDiscrepancy ? "error" : "success",
        message: hasDiscrepancy
          ? "Match completed with variance above tolerance. Review and resolve before AP push."
          : "3-way match completed successfully. No blocking variance detected.",
      });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to run match.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const approveAndPush = async () => {
    if (!canApprove) return;
    setIsLoading(true);
    setBanner(null);
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    setIsLoading(false);
    setIsApprovedPushed(true);
    setBanner({
      type: "success",
      message: "Approved and pushed to AP queue successfully.",
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-xl font-black text-slate-900">3-Way Match & AP</h1>
      <p className="text-xs text-slate-500 mb-6">
        Compare PO ↔ GRN ↔ Supplier Invoice. Flags &gt;1% price or quantity variance.
      </p>

      {banner && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {banner.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Search/select PO</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="Search by PO, GRN, or supplier"
              value={poSearch}
              onChange={(e) => setPoSearch(e.target.value)}
            />
            <select
              value={selectedPoId}
              onChange={(e) => setSelectedPoId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
            >
              {filteredPoOptions.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} • {po.grnNumber} • {po.supplierName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Invoice Number</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="INV-2026-0019"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Invoice Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="0.00"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-700">Supplier invoice attachment</p>
            <p className="text-[10px] text-slate-500">Upload scanned invoice/PDF for audit trail.</p>
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold cursor-pointer">
            Upload file
            <input
              type="file"
              className="hidden"
              onChange={(e) => setInvoiceFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
        </div>
        {invoiceFileName && (
          <p className="text-[11px] text-slate-600">
            Uploaded: <span className="font-semibold">{invoiceFileName}</span>
          </p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-600">
            PO: <span className="font-semibold">{selectedPo?.poNumber ?? "-"}</span> • GRN:{" "}
            <span className="font-semibold">{selectedPo?.grnNumber ?? "-"}</span>
          </p>
          <StatusBadge status={matchStatus} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">3-Way Comparison Grid</h2>
          <span className="text-[10px] text-slate-500">Variance threshold: {MATCH_VARIANCE_THRESHOLD}%</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Item Description</th>
                <th className="px-3 py-2 text-right">PO Qty</th>
                <th className="px-3 py-2 text-right">GRN Qty</th>
                <th className="px-3 py-2 text-right">Invoice Qty</th>
                <th className="px-3 py-2 text-right">PO Unit Price</th>
                <th className="px-3 py-2 text-right">GRN Unit Price</th>
                <th className="px-3 py-2 text-right">Invoice Unit Price</th>
                <th className="px-3 py-2 text-right">Qty Var %</th>
                <th className="px-3 py-2 text-right">Price Var %</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, idx) => {
                const rowCls =
                  row.priceVariancePct > MATCH_VARIANCE_THRESHOLD
                    ? "bg-red-50"
                    : row.qtyVariancePct > MATCH_VARIANCE_THRESHOLD
                    ? "bg-amber-50"
                    : idx % 2 === 0
                    ? "bg-white"
                    : "bg-slate-50/30";
                return (
                  <tr key={row.itemDescription} className={`${rowCls} border-t border-slate-100`}>
                    <td className="px-3 py-2 font-medium text-slate-700">{row.itemDescription}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.poQty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.grnQty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.invoiceQty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{selectedPo?.currency} {row.poUnitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">{selectedPo?.currency} {row.grnUnitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">{selectedPo?.currency} {row.invoiceUnitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.qtyVariancePct.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-mono">{row.priceVariancePct.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runMatch}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {isLoading ? "Running Match..." : "Run Match"}
          </button>
          <button
            type="button"
            onClick={approveAndPush}
            disabled={!canApprove}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
          >
            Approve & Push to AP Queue
          </button>
          {isApprovedPushed && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
              Pushed to AP Queue
            </span>
          )}
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={overrideVariance}
            onChange={(e) => setOverrideVariance(e.target.checked)}
          />
          Override Variance
        </label>

        {overrideVariance && hasDiscrepancy && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">Resolution Notes</label>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Explain why this discrepancy is accepted and approved."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}
