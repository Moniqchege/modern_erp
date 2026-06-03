import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Truck,
  PackageCheck,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { apiFetch } from "../../api/apiClient";
import { getCurrentUser } from "../../auth/authClient";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";

type TransferStatus =
  | "PENDING"
  | "APPROVED_IN_TRANSIT"
  | "COMPLETED"
  | "REJECTED"
  | "RECEIPT_REJECTED"
  | "PENDING_CORRECTION";

type TransferLine = {
  id: string;
  itemId: string;
  qtyRequested: number;
  qtyIssued: number | null;
  partialIssueReason: string | null;
  qtyReceived: number | null;
  discrepancyNote: string | null;
  item: { sku: string; name: string; unit: string };
};

type StockTransfer = {
  id: string;
  requestNumber: string;
  status: TransferStatus;
  notes: string | null;
  rejectionReason: string | null;
  receiptRejectionReason: string | null;
  receiptRejectedAt: string | null;
  sourceLocation: { code: string; name: string };
  destinationLocation: { code: string; name: string };
  items: TransferLine[];
  requestedBy: { name: string; role: string };
  approvedBy: { name: string; role: string } | null;
  receiptRejectedBy: { name: string; role: string } | null;
  createdAt: string;
  updatedAt: string;
};

function canApprove(role: string) {
  return (
    role === "SUPERADMIN" || role === "ADMIN" || role === "MAIN_STORE_MANAGER"
  );
}

function canReceive(role: string, dest: string) {
  if (role === "SUPERADMIN" || role === "ADMIN") return true;
  const map: Record<string, string> = {
    MAIZE_STORE_MANAGER: "MAIZE_STORE",
    PACKAGING_STORE_MANAGER: "PACKAGING_STORE",
    DISPATCH_STORE_MANAGER: "DISPATCH_STORE",
  };
  return map[role] === dest;
}

function fmt(n: number | null | undefined, unit?: string) {
  if (n == null) return "—";
  return `${n.toFixed(3)}${unit ? " " + unit : ""}`;
}

// ── Issue line editor ─────────────────────────────────────────────────────────
// Each line has an editable "qty to issue" and, when below requested, a reason.
type IssueLineState = {
  qtyIssued: number | "";
  partialIssueReason: string;
};

// ── Receive line editor ───────────────────────────────────────────────────────
type ReceiveLineState = {
  qtyReceived: number | "";
};

export function StockTransferDetail() {
  const { transferId } = useParams<{ transferId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = user?.role ?? "";

  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Panel visibility
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [showRejectReceiptForm, setShowRejectReceiptForm] = useState(false);

  // Issue form state — keyed by lineId
  const [issueLines, setIssueLines] = useState<Record<string, IssueLineState>>({});

  // Receive form state — keyed by lineId
  const [receiveLines, setReceiveLines] = useState<Record<string, ReceiveLineState>>({});

  // Reject / reject-receipt reasons
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReceiptReason, setRejectReceiptReason] = useState("");

  const load = useCallback(async () => {
    if (!transferId) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/stock-transfers/${transferId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      const t: StockTransfer = j.transfer;
      setTransfer(t);

      // Seed issue-form defaults from current data
      const initIssue: Record<string, IssueLineState> = {};
      for (const line of t.items) {
        initIssue[line.id] = {
          qtyIssued: line.qtyIssued ?? line.qtyRequested,
          partialIssueReason: line.partialIssueReason ?? "",
        };
      }
      setIssueLines(initIssue);

      // Seed receive-form defaults
      const initReceive: Record<string, ReceiveLineState> = {};
      for (const line of t.items) {
        initReceive[line.id] = {
          qtyReceived: line.qtyIssued ?? line.qtyRequested,
        };
      }
      setReceiveLines(initReceive);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to load transfer");
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  useEffect(() => { void load(); }, [load]);

  // ── submit helpers ───────────────────────────────────────────────────────

  const handleIssue = async () => {
    if (!transfer) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const lines = transfer.items.map((line) => {
        const s = issueLines[line.id];
        const qtyIssued = typeof s?.qtyIssued === "number" ? s.qtyIssued : line.qtyRequested;
        const isPartial = qtyIssued < line.qtyRequested - 0.0005;
        return {
          lineId: line.id,
          qtyIssued,
          ...(isPartial ? { partialIssueReason: s?.partialIssueReason?.trim() } : {}),
        };
      });
      const res = await apiFetch(`/api/stock-transfers/${transfer.id}/approve-issue`, {
        method: "POST",
        body: JSON.stringify({ lines }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Approve failed");
      setShowIssueForm(false);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async () => {
    if (!transfer) return;
    if (!rejectReason.trim()) { setActionError("Rejection reason is required."); return; }
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/stock-transfers/${transfer.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Reject failed");
      setShowRejectForm(false);
      setRejectReason("");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setActionBusy(false);
    }
  };

  const handleReceive = async () => {
    if (!transfer) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const lines = transfer.items.map((line) => {
        const s = receiveLines[line.id];
        return {
          lineId: line.id,
          qtyReceived: typeof s?.qtyReceived === "number"
            ? s.qtyReceived
            : (line.qtyIssued ?? line.qtyRequested),
        };
      });
      const res = await apiFetch(`/api/stock-transfers/${transfer.id}/receive`, {
        method: "POST",
        body: JSON.stringify({ lines }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Receive failed");
      setShowReceiveForm(false);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectReceipt = async () => {
    if (!transfer) return;
    if (!rejectReceiptReason.trim()) { setActionError("Rejection reason is required."); return; }
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/stock-transfers/${transfer.id}/reject-receipt`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: rejectReceiptReason.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Reject receipt failed");
      setShowRejectReceiptForm(false);
      setRejectReceiptReason("");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Reject receipt failed");
    } finally {
      setActionBusy(false);
    }
  };

  // ── derived ──────────────────────────────────────────────────────────────

  const canApproveTransfer = canApprove(role);
  const canReceiveTransfer = transfer
    ? canReceive(role, transfer.destinationLocation.code)
    : false;

  // ── loading / not found ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-20 text-slate-400 text-xs">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-sm text-slate-500">Transfer not found.</p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFERS)}
          className="text-xs font-bold text-orange-600"
        >
          Back to list
        </button>
      </div>
    );
  }

  const t = transfer;

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back to transfers"
          onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFERS)}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 font-mono">
              {t.requestNumber}
            </h1>
            <StatusBadge status={t.status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.sourceLocation.name} → {t.destinationLocation.name}
            {" · "}Requested by {t.requestedBy.name}
          </p>
        </div>
      </div>

      {/* Global error */}
      {actionError && (
        <div className="flex gap-2 items-start bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 text-xs font-bold text-rose-600">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {actionError}
        </div>
      )}

      {/* Status banners */}
      {t.status === "REJECTED" && t.rejectionReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-0.5">
          <p className="text-[10px] font-extrabold text-red-600 uppercase tracking-widest">
            Request rejected
          </p>
          <p className="text-xs text-red-700">{t.rejectionReason}</p>
          {t.approvedBy && (
            <p className="text-[10px] text-red-400">by {t.approvedBy.name}</p>
          )}
        </div>
      )}

      {t.status === "PENDING_CORRECTION" && t.receiptRejectionReason && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 space-y-0.5">
          <p className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest">
            Delivery rejected by receiving store — awaiting correction
          </p>
          <p className="text-xs text-orange-800">{t.receiptRejectionReason}</p>
          {t.receiptRejectedBy && (
            <p className="text-[10px] text-orange-500">
              by {t.receiptRejectedBy.name}
              {t.receiptRejectedAt &&
                ` · ${new Date(t.receiptRejectedAt).toLocaleString()}`}
            </p>
          )}
        </div>
      )}

      {t.notes && (
        <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3">
          {t.notes}
        </p>
      )}

      {/* Line items table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            Line items
          </p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-5 py-2 text-[10px] font-bold text-slate-400 uppercase">Item</th>
              <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Requested</th>
              <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Issued</th>
              <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {t.items.map((line) => {
              const isPartial =
                line.qtyIssued != null &&
                line.qtyIssued < line.qtyRequested - 0.0005;
              const isShort =
                line.qtyReceived != null &&
                line.qtyIssued != null &&
                line.qtyReceived < line.qtyIssued - 0.0005;
              return (
                <React.Fragment key={line.id}>
                  <tr>
                    <td className="px-5 py-2.5">
                      <p className="font-bold text-slate-800">{line.item.name}</p>
                      <p className="text-[10px] text-slate-400">{line.item.sku}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                      {fmt(line.qtyRequested, line.item.unit)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {line.qtyIssued == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={isPartial ? "text-amber-600 font-bold" : "text-slate-700"}>
                          {fmt(line.qtyIssued, line.item.unit)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {line.qtyReceived == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={isShort ? "text-rose-600 font-bold" : "text-emerald-700"}>
                          {fmt(line.qtyReceived, line.item.unit)}
                        </span>
                      )}
                    </td>
                  </tr>
                  {isPartial && line.partialIssueReason && (
                    <tr>
                      <td colSpan={4} className="px-5 pb-2.5">
                        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                          <span className="font-bold">Partial issue: </span>
                          {line.partialIssueReason}
                        </p>
                      </td>
                    </tr>
                  )}
                  {isShort && line.discrepancyNote && (
                    <tr>
                      <td colSpan={4} className="px-5 pb-2.5">
                        <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1">
                          <span className="font-bold">Discrepancy: </span>
                          {line.discrepancyNote}
                        </p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── ACTION PANELS ─────────────────────────────────────────────────── */}

      {/* APPROVE & ISSUE — available for PENDING and PENDING_CORRECTION */}
      {(t.status === "PENDING" || t.status === "PENDING_CORRECTION") &&
        canApproveTransfer && (
          <div className="space-y-2">
            {!showIssueForm && !showRejectForm && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowIssueForm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                >
                  <Truck className="h-3.5 w-3.5" />
                  {t.status === "PENDING_CORRECTION" ? "Re-issue corrected transfer" : "Approve & issue"}
                </button>
                {t.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject request
                  </button>
                )}
              </div>
            )}

            {/* Issue form */}
            {showIssueForm && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-4">
                <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">
                  {t.status === "PENDING_CORRECTION"
                    ? "Re-issue — enter corrected quantities"
                    : "Approve & issue — enter quantities to dispatch"}
                </p>
                <p className="text-[10px] text-emerald-600">
                  You may issue less than requested if stock is limited.
                  A reason is required whenever you issue less than requested.
                </p>

                {t.items.map((line) => {
                  const s = issueLines[line.id] ?? {
                    qtyIssued: line.qtyRequested,
                    partialIssueReason: "",
                  };
                  const qty = typeof s.qtyIssued === "number" ? s.qtyIssued : line.qtyRequested;
                  const isPartial = qty < line.qtyRequested - 0.0005;

                  return (
                    <div key={line.id} className="bg-white border border-emerald-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{line.item.name}</p>
                          <p className="text-[10px] text-slate-400">
                            Requested: {fmt(line.qtyRequested, line.item.unit)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor={`issue-qty-${line.id}`}
                          className="text-[9px] font-extrabold text-slate-400 uppercase"
                        >
                          Qty to issue ({line.item.unit})
                        </label>
                        <input
                          id={`issue-qty-${line.id}`}
                          type="number"
                          step="0.001"
                          min="0.001"
                          max={line.qtyRequested}
                          value={s.qtyIssued}
                          onChange={(e) => {
                            const v = e.target.value;
                            setIssueLines((prev) => ({
                              ...prev,
                              [line.id]: {
                                ...prev[line.id],
                                qtyIssued: v === "" ? "" : parseFloat(v),
                              },
                            }));
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400"
                        />
                        {isPartial && (
                          <p className="text-[10px] text-amber-600 font-bold">
                            ↓ {(line.qtyRequested - qty).toFixed(3)}{" "}{line.item.unit} short of request
                          </p>
                        )}
                      </div>

                      {isPartial && (
                        <div className="space-y-1">
                          <label
                            htmlFor={`issue-reason-${line.id}`}
                            className="text-[9px] font-extrabold text-amber-600 uppercase"
                          >
                            Reason for partial issue *
                          </label>
                          <textarea
                            id={`issue-reason-${line.id}`}
                            rows={2}
                            placeholder="e.g. Only 80 kg in stock; remaining 20 kg expected from procurement on 10 Jun"
                            value={s.partialIssueReason}
                            onChange={(e) =>
                              setIssueLines((prev) => ({
                                ...prev,
                                [line.id]: {
                                  ...prev[line.id],
                                  partialIssueReason: e.target.value,
                                },
                              }))
                            }
                            className="w-full bg-slate-50 border border-amber-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 resize-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleIssue}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {actionBusy
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Truck className="h-3.5 w-3.5" />}
                    Confirm &amp; dispatch
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => { setShowIssueForm(false); setActionError(null); }}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Reject request form */}
            {showRejectForm && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-extrabold text-red-700 uppercase tracking-widest">
                  Reject this request
                </p>
                <div className="space-y-1">
                  <label
                    htmlFor="reject-reason"
                    className="text-[9px] font-extrabold text-red-500 uppercase"
                  >
                    Reason *
                  </label>
                  <textarea
                    id="reject-reason"
                    rows={3}
                    placeholder="Explain why the request cannot be fulfilled…"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-400 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={actionBusy || !rejectReason.trim()}
                    onClick={handleReject}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {actionBusy
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <XCircle className="h-3.5 w-3.5" />}
                    Confirm rejection
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => { setShowRejectForm(false); setRejectReason(""); setActionError(null); }}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      {/* RECEIVE — available for APPROVED_IN_TRANSIT */}
      {t.status === "APPROVED_IN_TRANSIT" && canReceiveTransfer && (
        <div className="space-y-2">
          {!showReceiveForm && !showRejectReceiptForm && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowReceiveForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"
              >
                <PackageCheck className="h-3.5 w-3.5" />
                Acknowledge receipt
              </button>
              <button
                type="button"
                onClick={() => setShowRejectReceiptForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-orange-200 text-orange-700 text-xs font-bold"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject delivery
              </button>
            </div>
          )}

          {/* Receive form */}
          {showReceiveForm && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-4">
              <p className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-widest">
                Acknowledge receipt — enter quantities actually received
              </p>
              <p className="text-[10px] text-indigo-600">
                Enter the exact quantity you physically received for each item.
                Any shortfall will be logged as a discrepancy.
                If the delivery is entirely wrong, cancel and use "Reject delivery" instead.
              </p>

              {t.items.map((line) => {
                const s = receiveLines[line.id];
                const issued = line.qtyIssued ?? line.qtyRequested;
                const received = typeof s?.qtyReceived === "number" ? s.qtyReceived : issued;
                const isShort = received < issued - 0.0005;

                return (
                  <div key={line.id} className="bg-white border border-indigo-100 rounded-lg p-3 space-y-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{line.item.name}</p>
                      <p className="text-[10px] text-slate-400">
                        Issued: {fmt(issued, line.item.unit)}
                        {line.partialIssueReason && (
                          <span className="text-amber-600 ml-2">
                            (partial — {line.partialIssueReason})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`recv-qty-${line.id}`}
                        className="text-[9px] font-extrabold text-slate-400 uppercase"
                      >
                        Qty received ({line.item.unit})
                      </label>
                      <input
                        id={`recv-qty-${line.id}`}
                        type="number"
                        step="0.001"
                        min="0"
                        max={issued}
                        value={s?.qtyReceived ?? issued}
                        onChange={(e) => {
                          const v = e.target.value;
                          setReceiveLines((prev) => ({
                            ...prev,
                            [line.id]: {
                              qtyReceived: v === "" ? "" : parseFloat(v),
                            },
                          }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400"
                      />
                      {isShort && (
                        <p className="text-[10px] text-rose-600 font-bold">
                          ↓ {(issued - received).toFixed(3)} {line.item.unit} short — discrepancy will be logged
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleReceive}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {actionBusy
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <PackageCheck className="h-3.5 w-3.5" />}
                  Confirm receipt
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => { setShowReceiveForm(false); setActionError(null); }}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reject delivery form */}
          {showRejectReceiptForm && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-extrabold text-orange-700 uppercase tracking-widest">
                Reject this delivery
              </p>
              <p className="text-[10px] text-orange-600">
                This returns all stock to the main store and sends the transfer back
                for correction. Use this when the wrong items were delivered,
                goods are damaged, or there is a major mismatch.
              </p>
              <div className="space-y-1">
                <label
                  htmlFor="reject-receipt-reason"
                  className="text-[9px] font-extrabold text-orange-600 uppercase"
                >
                  Reason for rejection *
                </label>
                <textarea
                  id="reject-receipt-reason"
                  rows={3}
                  placeholder="e.g. Received wheat flour instead of maize flour — wrong item delivered"
                  value={rejectReceiptReason}
                  onChange={(e) => setRejectReceiptReason(e.target.value)}
                  className="w-full bg-white border border-orange-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionBusy || !rejectReceiptReason.trim()}
                  onClick={handleRejectReceipt}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {actionBusy
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <XCircle className="h-3.5 w-3.5" />}
                  Confirm rejection
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => {
                    setShowRejectReceiptForm(false);
                    setRejectReceiptReason("");
                    setActionError(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed state */}
      {t.status === "COMPLETED" && (
        <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
          <CheckCircle2 className="h-4 w-4" />
          Transfer completed
        </div>
      )}

      {/* Rejected terminal state */}
      {t.status === "REJECTED" && (
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <XCircle className="h-4 w-4" />
          This request was rejected and is now closed.
        </div>
      )}

      {/* Meta footer */}
      <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3 space-y-0.5">
        {t.approvedBy && (
          <p>
            <span className="font-bold">Issued by:</span> {t.approvedBy.name}
          </p>
        )}
        <p>
          <Clock className="h-3 w-3 inline mr-1" />
          Created {new Date(t.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
