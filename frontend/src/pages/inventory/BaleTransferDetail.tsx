import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Truck,
  PackageCheck,
  XCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { apiFetch } from "../../api/apiClient";
import { getCurrentUser } from "../../auth/authClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type TransferStatus =
  | "PENDING"
  | "APPROVED_IN_TRANSIT"
  | "COMPLETED"
  | "REJECTED"
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
  // bale context enriched by backend
  typeKey: string | null;
  kgPerUnit: number;
  totalKg: number;
};

type BaleTransfer = {
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
  approvedAt: string | null;
  completedAt: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, unit?: string) {
  if (n == null) return "—";
  return `${n.toFixed(3)}${unit ? " " + unit : ""}`;
}

function fmtBales(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n} ${n === 1 ? "bale" : "bales"}`;
}

const BALE_TYPE_LABEL: Record<string, string> = {
  KHAKI_BALER_2KG:   "Khaki baler 2 kg",
  KHAKI_BALER_1KG:   "Khaki baler 1 kg",
  KHAKI_BALER_0_5KG: "Khaki baler 0.5 kg",
  NYLON_BALER_2KG:   "Nylon baler 2 kg",
  NYLON_BALER_1KG:   "Nylon baler 1 kg",
  NYLON_BALER_0_5KG: "Nylon baler 0.5 kg",
  LAMINATED_BALER:   "Laminated baler",
  BAG_5KG:           "Bag 5 kg",
  BAG_10KG:          "Bag 10 kg",
  BAG_50KG:          "Bag 50 kg",
  BAG_90KG:          "Bag 90 kg",
  PACKETS_1KG:       "Packet 1 kg",
  PACKETS_2KG:       "Packet 2 kg",
};

function baleTypeLabel(typeKey: string | null) {
  if (!typeKey) return null;
  return BALE_TYPE_LABEL[typeKey] ?? typeKey;
}

const STATUS_LABEL: Record<TransferStatus, string> = {
  PENDING: "Pending",
  APPROVED_IN_TRANSIT: "In Transit",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  PENDING_CORRECTION: "Needs Correction",
};

const STATUS_CLASS: Record<TransferStatus, string> = {
  PENDING: "text-amber-600 bg-amber-50 border-amber-200",
  APPROVED_IN_TRANSIT: "text-blue-600 bg-blue-50 border-blue-200",
  COMPLETED: "text-emerald-600 bg-emerald-50 border-emerald-200",
  REJECTED: "text-rose-600 bg-rose-50 border-rose-200",
  PENDING_CORRECTION: "text-orange-600 bg-orange-50 border-orange-200",
};

type IssueLineState = { qtyIssued: number | ""; partialIssueReason: string };
type ReceiveLineState = { qtyReceived: number | "" };

// ─── Component ────────────────────────────────────────────────────────────────

export function BaleTransferDetail() {
  const { transferId } = useParams<{ transferId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = user?.role ?? "";

  const isPackagingManager =
    role === "PACKAGING_STORE_MANAGER" || role === "ADMIN" || role === "SUPERADMIN";
  const isDispatchManager =
    role === "DISPATCH_STORE_MANAGER" || role === "ADMIN" || role === "SUPERADMIN";

  const [transfer, setTransfer] = useState<BaleTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Panel visibility
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [showRejectDeliveryForm, setShowRejectDeliveryForm] = useState(false);

  // Form state
  const [issueLines, setIssueLines] = useState<Record<string, IssueLineState>>({});
  const [receiveLines, setReceiveLines] = useState<Record<string, ReceiveLineState>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDeliveryReason, setRejectDeliveryReason] = useState("");

  const load = useCallback(async () => {
    if (!transferId) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/bale-transfers/${transferId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const j = await res.json();
      const t: BaleTransfer = j.transfer;
      setTransfer(t);

      const initIssue: Record<string, IssueLineState> = {};
      const initReceive: Record<string, ReceiveLineState> = {};
      for (const line of t.items) {
        initIssue[line.id] = {
          qtyIssued: line.qtyIssued ?? line.qtyRequested,
          partialIssueReason: line.partialIssueReason ?? "",
        };
        initReceive[line.id] = {
          qtyReceived: line.qtyIssued ?? line.qtyRequested,
        };
      }
      setIssueLines(initIssue);
      setReceiveLines(initReceive);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to load transfer");
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  useEffect(() => { void load(); }, [load]);

  // ── action handlers ──────────────────────────────────────────────────────────

  const handleIssue = async () => {
    if (!transfer) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const lines = transfer.items.map((line) => {
        const s = issueLines[line.id];
        const qtyIssued =
          typeof s?.qtyIssued === "number" ? s.qtyIssued : line.qtyRequested;
        const isPartial = qtyIssued < line.qtyRequested - 0.0005;
        return {
          lineId: line.id,
          qtyIssued,
          ...(isPartial && s?.partialIssueReason?.trim()
            ? { partialIssueReason: s.partialIssueReason.trim() }
            : {}),
        };
      });
      const res = await apiFetch(`/api/bale-transfers/${transfer.id}/issue`, {
        method: "POST",
        body: JSON.stringify({ lines }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Issue failed");
      setShowIssueForm(false);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Issue failed");
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
      const res = await apiFetch(`/api/bale-transfers/${transfer.id}/reject`, {
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
          qtyReceived:
            typeof s?.qtyReceived === "number"
              ? s.qtyReceived
              : (line.qtyIssued ?? line.qtyRequested),
        };
      });
      const res = await apiFetch(`/api/bale-transfers/${transfer.id}/receive`, {
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

  const handleRejectDelivery = async () => {
    if (!transfer) return;
    if (!rejectDeliveryReason.trim()) {
      setActionError("Rejection reason is required.");
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch(`/api/bale-transfers/${transfer.id}/reject-delivery`, {
        method: "POST",
        body: JSON.stringify({ receiptRejectionReason: rejectDeliveryReason.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Reject delivery failed");
      setShowRejectDeliveryForm(false);
      setRejectDeliveryReason("");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Reject delivery failed");
    } finally {
      setActionBusy(false);
    }
  };

  // ── loading / not found ──────────────────────────────────────────────────────

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
          onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS)}
          className="text-xs font-bold text-orange-600"
        >
          Back to list
        </button>
      </div>
    );
  }

  const t = transfer;
  const statusClass = STATUS_CLASS[t.status] ?? STATUS_CLASS.PENDING;

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFERS)}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 font-mono">
              {t.requestNumber}
            </h1>
            <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusClass}`}>
              {STATUS_LABEL[t.status]}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.sourceLocation.name} → {t.destinationLocation.name}
            {" · "}Requested by {t.requestedBy.name}
            {" · "}{new Date(t.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Error */}
      {actionError && (
        <div className="flex gap-2 items-start bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 text-xs font-bold text-rose-600">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {actionError}
        </div>
      )}

      {/* Status banners */}
      {t.status === "REJECTED" && t.rejectionReason && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 space-y-0.5">
          <p className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest">Request rejected</p>
          <p className="text-xs text-rose-700">{t.rejectionReason}</p>
          {t.approvedBy && <p className="text-[10px] text-rose-400">by {t.approvedBy.name}</p>}
        </div>
      )}

      {t.status === "PENDING_CORRECTION" && t.receiptRejectionReason && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 space-y-0.5">
          <p className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest">
            Delivery rejected — awaiting correction
          </p>
          <p className="text-xs text-orange-800">{t.receiptRejectionReason}</p>
          {t.receiptRejectedBy && (
            <p className="text-[10px] text-orange-500">
              by {t.receiptRejectedBy.name}
              {t.receiptRejectedAt && ` · ${new Date(t.receiptRejectedAt).toLocaleString()}`}
            </p>
          )}
        </div>
      )}

      {t.status === "COMPLETED" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-xs font-bold text-emerald-700">
            Completed{t.completedAt ? ` · ${new Date(t.completedAt).toLocaleString()}` : ""}
          </p>
        </div>
      )}

      {t.notes && (
        <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3">{t.notes}</p>
      )}

      {/* Line items table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            Bale Items
          </p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-5 py-2 text-[10px] font-bold text-slate-400 uppercase">Brand / Item</th>
              <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Bale Format</th>
              <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Requested</th>
              <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Issued</th>
              <th className="text-right px-4 py-2 text-[10px] font-bold text-slate-400 uppercase">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {t.items.map((line) => {
              const isPartial =
                line.qtyIssued != null && line.qtyIssued < line.qtyRequested - 0.0005;
              const isShort =
                line.qtyReceived != null &&
                line.qtyIssued != null &&
                line.qtyReceived < line.qtyIssued - 0.0005;
              const label = baleTypeLabel(line.typeKey);
              const issuedKg = line.qtyIssued != null ? line.qtyIssued * line.kgPerUnit : null;
              const receivedKg = line.qtyReceived != null ? line.qtyReceived * line.kgPerUnit : null;

              return (
                <React.Fragment key={line.id}>
                  <tr>
                    <td className="px-5 py-2.5">
                      <p className="font-bold text-slate-800">{line.item.name}</p>
                      <p className="text-[10px] text-slate-400">{line.item.sku}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {line.qtyRequested} bales × {line.kgPerUnit} kg = {line.totalKg} kg
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      {label ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {label}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                      <p>{fmtBales(line.qtyRequested)}</p>
                      <p className="text-[10px] text-slate-400">{line.totalKg} kg</p>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {line.qtyIssued == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <>
                          <p className={isPartial ? "text-amber-600 font-bold" : "text-slate-700"}>
                            {fmtBales(line.qtyIssued)}
                          </p>
                          <p className="text-[10px] text-slate-400">{issuedKg} kg</p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {line.qtyReceived == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <>
                          <p className={isShort ? "text-rose-600 font-bold" : "text-emerald-700"}>
                            {fmtBales(line.qtyReceived)}
                          </p>
                          <p className="text-[10px] text-slate-400">{receivedKg} kg</p>
                        </>
                      )}
                    </td>
                  </tr>
                  {isPartial && line.partialIssueReason && (
                    <tr>
                      <td colSpan={5} className="px-5 pb-2.5">
                        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                          <span className="font-bold">Partial issue: </span>
                          {line.partialIssueReason}
                        </p>
                      </td>
                    </tr>
                  )}
                  {isShort && line.discrepancyNote && (
                    <tr>
                      <td colSpan={5} className="px-5 pb-2.5">
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

      {/* ── ACTION PANELS ──────────────────────────────────────────────────────── */}

      {/* ISSUE / REJECT — Packaging Store Manager, for PENDING or PENDING_CORRECTION */}
      {(t.status === "PENDING" || t.status === "PENDING_CORRECTION") && isPackagingManager && (
        <div className="space-y-2">
          {!showIssueForm && !showRejectForm && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowIssueForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"
              >
                <Truck className="h-3.5 w-3.5" />
                {t.status === "PENDING_CORRECTION" ? "Re-issue corrected transfer" : "Issue bales"}
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
                  : "Issue bales — confirm quantities to dispatch"}
              </p>
              <p className="text-[10px] text-emerald-600">
                You may issue less than requested if stock is limited. A reason is required for any shortfall.
              </p>

              {t.items.map((line) => {
                const s = issueLines[line.id] ?? { qtyIssued: line.qtyRequested, partialIssueReason: "" };
                const qty = typeof s.qtyIssued === "number" ? s.qtyIssued : line.qtyRequested;
                const isPartial = qty < line.qtyRequested - 0.0005;

                return (
                  <div key={line.id} className="bg-white border border-emerald-100 rounded-lg p-3 space-y-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{line.item.name}</p>
                      <p className="text-[10px] text-slate-400">
                        Requested: {fmtBales(line.qtyRequested)} ({line.totalKg} kg)
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`issue-qty-${line.id}`} className="text-[9px] font-extrabold text-slate-400 uppercase">
                        Bales to issue
                      </label>
                      <input
                        id={`issue-qty-${line.id}`}
                        type="number" step="0.001" min="0.001" max={line.qtyRequested}
                        value={s.qtyIssued}
                        onChange={(e) => {
                          const v = e.target.value;
                          setIssueLines((prev) => ({
                            ...prev,
                            [line.id]: { ...prev[line.id], qtyIssued: v === "" ? "" : parseFloat(v) },
                          }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400"
                      />
                      {isPartial && (
                        <p className="text-[10px] text-amber-600 font-bold">
                          ↓ {(line.qtyRequested - qty)} bale{line.qtyRequested - qty !== 1 ? "s" : ""} short
                        </p>
                      )}
                    </div>
                    {isPartial && (
                      <div className="space-y-1">
                        <label htmlFor={`issue-reason-${line.id}`} className="text-[9px] font-extrabold text-amber-600 uppercase">
                          Reason for partial issue *
                        </label>
                        <textarea
                          id={`issue-reason-${line.id}`}
                          rows={2}
                          placeholder="e.g. Only 6 bales available; rest expected after tomorrow's run"
                          value={s.partialIssueReason}
                          onChange={(e) =>
                            setIssueLines((prev) => ({
                              ...prev,
                              [line.id]: { ...prev[line.id], partialIssueReason: e.target.value },
                            }))
                          }
                          className="w-full bg-slate-50 border border-amber-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-orange-400"
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
                  {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
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

          {/* Reject form */}
          {showRejectForm && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">
                Reject this request
              </p>
              <textarea
                rows={3}
                placeholder="Explain why this request cannot be fulfilled…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-rose-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionBusy || !rejectReason.trim()}
                  onClick={handleReject}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
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

      {/* RECEIVE / REJECT DELIVERY — Dispatch Store Manager, for APPROVED_IN_TRANSIT */}
      {t.status === "APPROVED_IN_TRANSIT" && isDispatchManager && (
        <div className="space-y-2">
          {!showReceiveForm && !showRejectDeliveryForm && (
            <div className="flex flex-wrap gap-2">
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
                onClick={() => setShowRejectDeliveryForm(true)}
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
                Any shortfall will be logged as a discrepancy. To reject the whole delivery, cancel and use "Reject delivery".
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
                      <p className="text-[10px] text-slate-400">Issued: {fmtBales(issued)} ({issued * line.kgPerUnit} kg)</p>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`recv-qty-${line.id}`} className="text-[9px] font-extrabold text-slate-400 uppercase">
                        Bales received
                      </label>
                      <input
                        id={`recv-qty-${line.id}`}
                        type="number" step="0.001" min="0.001" max={issued}
                        value={s?.qtyReceived ?? issued}
                        onChange={(e) => {
                          const v = e.target.value;
                          setReceiveLines((prev) => ({
                            ...prev,
                            [line.id]: { qtyReceived: v === "" ? "" : parseFloat(v) },
                          }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400"
                      />
                      {isShort && (
                        <p className="text-[10px] text-rose-600 font-bold">
                          ↓ {(issued - received)} bale{issued - received !== 1 ? "s" : ""} short of issued qty
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
                  {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
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
          {showRejectDeliveryForm && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
              <p className="text-[10px] font-extrabold text-orange-700 uppercase tracking-widest">
                Reject delivery — stock will be returned to Packaging Store
              </p>
              <textarea
                rows={3}
                placeholder="e.g. Wrong bale types received, or items visibly damaged…"
                value={rejectDeliveryReason}
                onChange={(e) => setRejectDeliveryReason(e.target.value)}
                className="w-full bg-white border border-orange-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-orange-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actionBusy || !rejectDeliveryReason.trim()}
                  onClick={handleRejectDelivery}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  Confirm rejection
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => { setShowRejectDeliveryForm(false); setRejectDeliveryReason(""); setActionError(null); }}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
