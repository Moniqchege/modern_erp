import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Send, XCircle, CalendarDays,
  Package, CheckCircle2, ChevronDown, ChevronUp, Truck,
} from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { getCurrentUser } from "../../auth/authClient";
import { ROUTES } from "../../app/router/routes";

// ─── types ────────────────────────────────────────────────────────────────────

interface POLine {
  id: string;
  itemProfileId: string;
  itemProfile: { name: string; sku: string; category: string; unit: string };
  description?: string | null;
  quantity: string | number;
  unitPrice: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
  quantityReceived: string | number;
}

interface GRNLine {
  id: string;
  quantityAccepted: string | number;
  quantityRejected: string | number;
  unitPriceApplied: string | number;
  lineTotal: string | number;
  lotNumber?: string | null;
}

interface GRN {
  id: string;
  grnNumber: string;
  status: string;
  deliverySequence: number;
  batchTraceCode?: string | null;
  receivedAt: string;
  receivedBy: string;
  netWeightAccepted?: string | number | null;
  lines: GRNLine[];
  qcResults: Array<{ status: string; qcNumber?: string }>;
}

interface POFull {
  id: string;
  poNumber: string;
  status: string;
  currency: string;
  subtotal: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  expectedDelivery?: string | null;
  issuedAt?: string | null;
  issuedBy?: string | null;
  termsAndConditions?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string; name: string; code: string;
    taxPin?: string | null; phone?: string | null; email?: string | null;
  };
  requisition?: {
    id: string; requisitionNo: string; requestedBy: string;
    department?: string | null; requiredByDate?: string | null;
  } | null;
  lines: POLine[];
  grns: GRN[];
  approvals: Array<{
    id: string; level: string; approverName: string;
    decision: string; comments?: string | null; decidedAt: string;
  }>;
}

// ─── role helpers ─────────────────────────────────────────────────────────────

const APPROVER_ROLES = new Set(["MANAGER", "FINANCE_DIRECTOR", "ADMIN", "SUPERADMIN"]);

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const fmtDateOnly = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtMoney = (v: string | number | null | undefined, currency: string) => {
  const n = Number(v) || 0;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function isOverdue(po: POFull) {
  if (!po.expectedDelivery) return false;
  return new Date(po.expectedDelivery) < new Date() && po.status === "ISSUED";
}

const receiptProgress = (po: POFull) => {
  const totalOrdered = po.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const totalReceived = po.lines.reduce((s, l) => s + Number(l.quantityReceived), 0);
  if (totalOrdered === 0) return 0;
  return Math.min(100, (totalReceived / totalOrdered) * 100);
};


// ─── ProgressBar: uses CSS custom property to avoid inline style lint warning ──
function ProgressBar({ pct, done }: { pct: number; done: boolean }) {
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all progress-bar-fill ${done ? "bg-emerald-500" : "bg-sky-500"}`}
        data-pct={pct}
        ref={(el) => { if (el) el.style.setProperty("--pct", `${pct}%`); }}
      />
    </div>
  );
}

export function PurchaseOrderDetail() {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isApprover = user ? APPROVER_ROLES.has(user.role) : false;

  const [po, setPo] = useState<POFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [grnsOpen, setGrnsOpen] = useState(false);

  // action state
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");

  // ─── load ──────────────────────────────────────────────────────────────────

  const load = async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const d = await procurementApi.purchaseOrders.get(poId) as { purchaseOrder: POFull };
      setPo(d.purchaseOrder);
      // pre-fill delivery date picker with existing value
      if (d.purchaseOrder.expectedDelivery) {
        setDeliveryDate(d.purchaseOrder.expectedDelivery.slice(0, 10));
      }
    } catch {
      setPo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [poId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── actions ───────────────────────────────────────────────────────────────

  const handleIssue = async () => {
    if (!po) return;
    setActionBusy(true); setActionError(null);
    try {
      await procurementApi.purchaseOrders.issue(po.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to issue PO");
    } finally { setActionBusy(false); }
  };

  const handleCancel = async () => {
    if (!po) return;
    setActionBusy(true); setActionError(null);
    try {
      await procurementApi.purchaseOrders.cancel(po.id, cancelReason || undefined);
      setShowCancelForm(false); setCancelReason("");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to cancel PO");
    } finally { setActionBusy(false); }
  };

  const handleUpdateDelivery = async () => {
    if (!po || !deliveryDate) return;
    setActionBusy(true); setActionError(null);
    try {
      await procurementApi.purchaseOrders.updateExpectedDelivery(po.id, deliveryDate);
      setShowDeliveryForm(false);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update delivery date");
    } finally { setActionBusy(false); }
  };

  // ─── derived ───────────────────────────────────────────────────────────────

  const canIssue = isApprover && po?.status === "DRAFT";
  const canCancel = isApprover && (po?.status === "DRAFT" || po?.status === "ISSUED");
  const canEditDelivery = isApprover && po?.status !== "CANCELLED" && po?.status !== "CLOSED";
  const progress = po ? receiptProgress(po) : 0;

  // ─── loading / not found ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-400 text-xs gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!po) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-500">Purchase order not found.</p>
        <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_POS)}
          className="mt-4 text-xs font-bold text-emerald-700">
          Back to list
        </button>
      </div>
    );
  }

  const subtotal = Number(po.subtotal) || 0;
  const taxAmount = Number(po.taxAmount) || 0;
  const total = Number(po.totalAmount) || 0;


  return (
    <div className="space-y-6">

      {/* back */}
      <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_POS)}
        className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Purchase Orders
      </button>

      {/* ── page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">{po.poNumber}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Created {fmtDate(po.createdAt)}
            {po.issuedAt && <> · Issued {fmtDate(po.issuedAt)} by {po.issuedBy}</>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={po.status} />
          {isOverdue(po) && (
            <span className="inline-block bg-red-100 text-red-700 text-[9px] px-2 py-0.5 rounded font-extrabold tracking-wide animate-pulse">
              OVERDUE
            </span>
          )}

          {/* Issue */}
          {canIssue && !showCancelForm && (
            <button type="button" disabled={actionBusy} onClick={() => void handleIssue()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
              {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Issue PO
            </button>
          )}

          {/* Set / edit delivery date */}
          {canEditDelivery && !showCancelForm && (
            <button type="button" onClick={() => { setShowDeliveryForm((v) => !v); setActionError(null); }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
              <CalendarDays className="h-3.5 w-3.5" />
              {po.expectedDelivery ? "Edit delivery date" : "Set delivery date"}
            </button>
          )}

          {/* Cancel */}
          {canCancel && !showCancelForm && (
            <button type="button" onClick={() => { setShowCancelForm(true); setShowDeliveryForm(false); setActionError(null); }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700">
              <XCircle className="h-3.5 w-3.5" /> Cancel PO
            </button>
          )}
        </div>
      </div>

      {/* error */}
      {actionError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{actionError}</p>
      )}

      {/* delivery date form */}
      {showDeliveryForm && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 space-y-3">
          <p className="text-xs font-bold text-sky-800">
            {po.expectedDelivery ? "Update expected delivery date" : "Set expected delivery date"}
          </p>
          <input type="date" aria-label="Expected delivery date"
            className="border border-sky-200 rounded-lg px-3 py-2 text-xs bg-white"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" disabled={actionBusy || !deliveryDate} onClick={() => void handleUpdateDelivery()}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50">
              {actionBusy ? "Saving…" : "Save date"}
            </button>
            <button type="button" onClick={() => setShowDeliveryForm(false)}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white rounded-lg border border-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* cancel form */}
      {showCancelForm && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 space-y-3">
          <p className="text-xs font-bold text-red-800">Cancel purchase order</p>
          <p className="text-xs text-red-700">This will mark the PO as CANCELLED. This action cannot be undone.</p>
          <textarea className="w-full border border-red-200 rounded-lg px-3 py-2 text-xs bg-white" rows={2}
            placeholder="Reason for cancellation (optional)"
            value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" disabled={actionBusy} onClick={() => void handleCancel()}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {actionBusy ? "Cancelling…" : "Confirm cancellation"}
            </button>
            <button type="button" onClick={() => setShowCancelForm(false)}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white rounded-lg border border-slate-200">
              Back
            </button>
          </div>
        </div>
      )}


      {/* ── receipt progress bar ─────────────────────────────────────────── */}
      {(po.status === "ISSUED" || po.status === "PARTIALLY_RECEIVED" || po.status === "FULLY_RECEIVED") && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Receipt progress</p>
            <p className="text-xs font-bold text-slate-700">{progress.toFixed(0)}%</p>
          </div>
          <ProgressBar pct={progress} done={progress >= 100} />
          <p className="text-[10px] text-slate-400 mt-1.5">
            {po.lines.reduce((s, l) => s + Number(l.quantityReceived), 0).toLocaleString()} of{" "}
            {po.lines.reduce((s, l) => s + Number(l.quantity), 0).toLocaleString()} units received
          </p>
        </div>
      )}

      {/* ── two-column info cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* PO details */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 text-xs">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest mb-3">PO details</h2>
          <p><span className="text-slate-500">Currency:</span> <span className="font-semibold">{po.currency}</span></p>
          <p><span className="text-slate-500">Tax rate:</span> {Number(po.taxRate).toFixed(0)}%</p>
          <p>
            <span className="text-slate-500">Expected delivery:</span>{" "}
            <span className={`font-semibold ${isOverdue(po) ? "text-red-600" : "text-slate-800"}`}>
              {fmtDateOnly(po.expectedDelivery)}
            </span>
          </p>
          {po.issuedAt && <p><span className="text-slate-500">Issued:</span> {fmtDate(po.issuedAt)} by {po.issuedBy}</p>}
          {po.termsAndConditions && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Terms &amp; conditions</p>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{po.termsAndConditions}</p>
            </div>
          )}
        </div>

        {/* Supplier + linked requisition */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 text-xs">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest mb-3">Supplier</h2>
          <p><span className="text-slate-500">Name:</span> <span className="font-semibold text-slate-800">{po.supplier.name}</span></p>
          <p><span className="text-slate-500">Code:</span> <span className="font-mono">{po.supplier.code}</span></p>
          <p><span className="text-slate-500">Tax PIN:</span> {po.supplier.taxPin ?? "—"}</p>
          <p><span className="text-slate-500">Phone:</span> {po.supplier.phone ?? "—"}</p>
          <p><span className="text-slate-500">Email:</span> {po.supplier.email ?? "—"}</p>
          <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_SUPPLIER_DETAIL(po.supplier.id))}
            className="mt-1 text-[10px] font-bold text-indigo-600 hover:underline">
            View supplier profile →
          </button>

          {po.requisition && (
            <div className="pt-3 mt-2 border-t border-slate-100 space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Source requisition</p>
              <p><span className="text-slate-500">Req No:</span> <span className="font-mono font-bold">{po.requisition.requisitionNo}</span></p>
              <p><span className="text-slate-500">Requested by:</span> {po.requisition.requestedBy}</p>
              {po.requisition.department && <p><span className="text-slate-500">Dept:</span> {po.requisition.department}</p>}
              {po.requisition.requiredByDate && (
                <p><span className="text-slate-500">Required by:</span> {fmtDateOnly(po.requisition.requiredByDate)}</p>
              )}
              <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_REQUISITION_DETAIL(po.requisition!.id))}
                className="text-[10px] font-bold text-indigo-600 hover:underline">
                View requisition →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── line items ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-400" />
          <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">Line items</h2>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wide border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-left">Item</th>
              <th className="px-5 py-3 text-left">Category</th>
              <th className="px-5 py-3 text-right">Ordered</th>
              <th className="px-5 py-3 text-right">Received</th>
              <th className="px-5 py-3 text-right">Unit price</th>
              <th className="px-5 py-3 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => {
              const received = Number(line.quantityReceived);
              const ordered = Number(line.quantity);
              const fullyReceived = received >= ordered;
              return (
                <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800">{line.itemProfile.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">{line.itemProfile.sku}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{line.itemProfile.category.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3 text-right font-mono">{ordered.toLocaleString()} {line.itemProfile.unit}</td>
                  <td className="px-5 py-3 text-right font-mono">
                    <span className={fullyReceived ? "text-emerald-600 font-bold" : received > 0 ? "text-amber-600 font-semibold" : "text-slate-400"}>
                      {received.toLocaleString()}
                    </span>
                    {fullyReceived && <CheckCircle2 className="inline h-3 w-3 text-emerald-500 ml-1" />}
                  </td>
                  <td className="px-5 py-3 text-right font-mono">{fmtMoney(line.unitPrice, po.currency)}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">{fmtMoney(line.lineTotal, po.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* totals footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <div className="space-y-1 text-xs text-right min-w-[260px]">
            <div className="flex justify-between gap-8">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono font-semibold text-slate-700">{fmtMoney(subtotal, po.currency)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-slate-500">VAT ({Number(po.taxRate).toFixed(0)}%)</span>
              <span className="font-mono font-semibold text-slate-700">{fmtMoney(taxAmount, po.currency)}</span>
            </div>
            <div className="flex justify-between gap-8 pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-800">Total</span>
              <span className="font-mono font-black text-slate-900 text-sm">{fmtMoney(total, po.currency)}</span>
            </div>
          </div>
        </div>
      </div>


      {/* ── GRNs (goods received notes) ──────────────────────────────────── */}
      {po.grns.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <button type="button" onClick={() => setGrnsOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left">
            <Truck className="h-4 w-4 text-slate-400" />
            <h2 className="font-extrabold text-slate-700 uppercase text-[10px] tracking-widest flex-1">
              Goods received notes ({po.grns.length})
            </h2>
            {grnsOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
          </button>

          {grnsOpen && (
            <div className="mt-4 space-y-3">
              {po.grns.map((grn) => (
                <div key={grn.id} className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div>
                      <span className="font-mono font-bold text-slate-800 text-xs">{grn.grnNumber}</span>
                      <span className="ml-2 text-[10px] text-slate-500">
                        Delivery #{grn.deliverySequence} · Received {fmtDate(grn.receivedAt)} by {grn.receivedBy}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {grn.qcResults.map((qc, i) => (
                        <StatusBadge key={i} status={qc.status} />
                      ))}
                      <StatusBadge status={grn.status} />
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-white text-slate-400 uppercase text-[10px] border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Lot</th>
                        <th className="px-4 py-2 text-right">Accepted</th>
                        <th className="px-4 py-2 text-right">Rejected</th>
                        <th className="px-4 py-2 text-right">Unit price</th>
                        <th className="px-4 py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grn.lines.map((l) => (
                        <tr key={l.id} className="border-b border-slate-50">
                          <td className="px-4 py-2 font-mono text-slate-500">{l.lotNumber ?? grn.batchTraceCode ?? "—"}</td>
                          <td className="px-4 py-2 text-right font-mono text-emerald-700 font-semibold">{Number(l.quantityAccepted).toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-red-600">{Number(l.quantityRejected) > 0 ? Number(l.quantityRejected).toLocaleString() : "—"}</td>
                          <td className="px-4 py-2 text-right font-mono">{fmtMoney(l.unitPriceApplied, po.currency)}</td>
                          <td className="px-4 py-2 text-right font-mono font-bold">{fmtMoney(l.lineTotal, po.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {grn.netWeightAccepted && (
                    <div className="px-4 py-2 bg-slate-50 text-[10px] text-slate-500 border-t border-slate-100">
                      Net weight accepted: <strong>{Number(grn.netWeightAccepted).toLocaleString()} kg</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── approval history ─────────────────────────────────────────────── */}
      {po.approvals.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest">Approval history</h2>
          <div className="space-y-2">
            {po.approvals.map((a) => (
              <div key={a.id}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-xs ${a.decision === "APPROVED" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                {a.decision === "APPROVED"
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <p className="font-bold text-slate-800">
                    {a.decision} by {a.approverName}
                    <span className="ml-2 text-[10px] font-normal text-slate-500">({a.level.replace(/_/g, " ")})</span>
                  </p>
                  {a.comments && <p className="text-slate-600 mt-0.5">{a.comments}</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(a.decidedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
