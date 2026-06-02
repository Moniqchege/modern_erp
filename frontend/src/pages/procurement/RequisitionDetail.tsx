import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock,
  ShoppingCart, ChevronDown, ChevronUp, FileText, Package,
} from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { getCurrentUser } from "../../auth/authClient";
import { ROUTES } from "../../app/router/routes";

// ─── types ───────────────────────────────────────────────────────────────────

interface RequisitionLine {
  id: string;
  itemProfileId: string;
  itemProfile: { name: string; sku: string; category: string; unit: string };
  quantity: string | number;
  unitPriceEstimate?: string | number | null;
  lineTotalEstimate?: string | number | null;
  notes?: string | null;
}

interface ApprovalRecord {
  id: string;
  level: string;
  approverId?: string | null;
  approverName: string;
  decision: string;
  comments?: string | null;
  decidedAt: string;
}

interface LinkedPO {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: string | number;
  currency: string;
  createdAt: string;
}

interface RequisitionFull {
  id: string;
  requisitionNo: string;
  status: string;
  requestedBy: string;
  department?: string | null;
  source?: string | null;
  justification?: string | null;
  requiredByDate?: string | null;
  estimatedTotal: string | number;
  currency: string;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: string; name: string; code: string; taxPin?: string | null; phone?: string | null; email?: string | null } | null;
  lines: RequisitionLine[];
  approvals: ApprovalRecord[];
  purchaseOrders: LinkedPO[];
}

interface AuditEntry {
  id: string;
  action: string;
  actorName?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  createdAt: string;
}

// ─── role helpers ─────────────────────────────────────────────────────────────

const MAKER_ROLES = new Set([
  "PROCUREMENT_OFFICER", "MANAGER", "ADMIN", "SUPERADMIN", "EMPLOYEE", "WAREHOUSE_OPERATOR",
]);
const APPROVER_ROLES = new Set(["MANAGER", "FINANCE_DIRECTOR", "ADMIN", "SUPERADMIN"]);

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const fmtMoney = (v: string | number | null | undefined, currency: string) => {
  const n = Number(v) || 0;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const sourceLabel: Record<string, string> = {
  MANUAL_PROCUREMENT: "Manual – Procurement",
  MANUAL_PLANT: "Manual – Plant request",
  LOW_STOCK_AUTO: "Auto – Low stock",
};


export function RequisitionDetail() {
  const { requisitionId } = useParams<{ requisitionId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isMaker = user ? MAKER_ROLES.has(user.role) : false;
  const isApprover = user ? APPROVER_ROLES.has(user.role) : false;

  const [req, setReq] = useState<RequisitionFull | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditOpen, setAuditOpen] = useState(false);

  // action state
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // create PO state
  const [showCreatePOForm, setShowCreatePOForm] = useState(false);
  const [applyVat, setApplyVat] = useState(true);

  // ─── load ────────────────────────────────────────────────────────────────

  const load = async () => {
    if (!requisitionId) return;
    setLoading(true);
    try {
      const d = await procurementApi.requisitions.get(requisitionId) as {
        requisition: RequisitionFull;
        auditLogs: AuditEntry[];
      };
      setReq(d.requisition);
      setAuditLogs(d.auditLogs ?? []);
    } catch {
      setReq(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [requisitionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── actions ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!req) return;
    setActionBusy(true); setActionError(null);
    try {
      await procurementApi.requisitions.submit(req.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to submit");
    } finally { setActionBusy(false); }
  };

  const handleApprove = async () => {
    if (!req) return;
    setActionBusy(true); setActionError(null);
    try {
      await procurementApi.requisitions.approve(req.id, approveComments || undefined);
      setShowApproveForm(false); setApproveComments("");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to approve");
    } finally { setActionBusy(false); }
  };

  const handleReject = async () => {
    if (!req) return;
    if (!rejectReason.trim()) { setActionError("Rejection reason is required."); return; }
    setActionBusy(true); setActionError(null);
    try {
      await procurementApi.requisitions.reject(req.id, rejectReason.trim());
      setShowRejectForm(false); setRejectReason("");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to reject");
    } finally { setActionBusy(false); }
  };

  const handleCreatePO = async () => {
    if (!req) return;
    setActionBusy(true); setActionError(null);
    try {
      await procurementApi.requisitions.createPO(req.id, undefined, applyVat);
      setShowCreatePOForm(false);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create PO");
    } finally { setActionBusy(false); }
  };

  // ─── derived ─────────────────────────────────────────────────────────────

  const isPending = req && (req.status === "PENDING_HEAD_PROCUREMENT" || req.status === "PENDING_FINANCE");
  const canSubmit = isMaker && req?.status === "DRAFT";
  const canApproveOrReject = isApprover && isPending;
  const canCreatePO = isApprover && req?.status === "APPROVED" && (!req.purchaseOrders || req.purchaseOrders.length === 0);

  const subtotal = Number(req?.estimatedTotal) || 0;
  const vat = applyVat ? subtotal * 0.16 : 0;
  const gross = subtotal + vat;

  // ─── loading / not found ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-400 text-xs gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!req) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-500">Requisition not found.</p>
        <button type="button" onClick={() => navigate(ROUTES.PROCUREMENT_REQUISITIONS)}
          className="mt-4 text-xs font-bold text-emerald-700">
          Back to list
        </button>
      </div>
    );
  }


  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* back */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.PROCUREMENT_REQUISITIONS)}
        className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Requisitions
      </button>

      {/* ── page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">{req.requisitionNo}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {sourceLabel[req.source ?? ""] ?? req.source ?? "Manual"} · Created {fmtDate(req.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={req.status} />

          {/* role badges */}
          {isMaker && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-bold">
              <FileText className="h-3 w-3" /> Maker
            </span>
          )}
          {isApprover && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-bold">
              <CheckCircle2 className="h-3 w-3" /> Approver
            </span>
          )}

          {/* primary action buttons */}
          {canSubmit && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              Submit for approval
            </button>
          )}

          {canApproveOrReject && !showApproveForm && !showRejectForm && (
            <>
              <button
                type="button"
                onClick={() => { setShowApproveForm(true); setShowRejectForm(false); setActionError(null); }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </button>
              <button
                type="button"
                onClick={() => { setShowRejectForm(true); setShowApproveForm(false); setActionError(null); }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </button>
            </>
          )}

          {canCreatePO && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => { setShowCreatePOForm((v) => !v); setActionError(null); }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              Create Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* error banner */}
      {actionError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
          {actionError}
        </p>
      )}

      {/* rejection reason banner */}
      {req.status === "REJECTED" && req.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1">Rejection reason</p>
          <p className="text-xs text-red-700">{req.rejectionReason}</p>
        </div>
      )}

      {/* approve inline form */}
      {showApproveForm && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 space-y-3">
          <p className="text-xs font-bold text-emerald-800">Confirm approval</p>
          <textarea
            className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-xs bg-white"
            rows={2}
            placeholder="Comments (optional)"
            value={approveComments}
            onChange={(e) => setApproveComments(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" disabled={actionBusy} onClick={() => void handleApprove()}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {actionBusy ? "Approving…" : "Confirm approval"}
            </button>
            <button type="button" onClick={() => setShowApproveForm(false)}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white rounded-lg border border-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* reject inline form */}
      {showRejectForm && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 space-y-3">
          <p className="text-xs font-bold text-red-800">Confirm rejection</p>
          <textarea
            className="w-full border border-red-200 rounded-lg px-3 py-2 text-xs bg-white"
            rows={2}
            placeholder="Rejection reason *"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" disabled={actionBusy} onClick={() => void handleReject()}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {actionBusy ? "Rejecting…" : "Confirm rejection"}
            </button>
            <button type="button" onClick={() => setShowRejectForm(false)}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white rounded-lg border border-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}


      {/* create PO inline form */}
      {showCreatePOForm && canCreatePO && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 space-y-3">
          <p className="text-xs font-bold text-indigo-800">Confirm Purchase Order creation</p>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyVat}
              onChange={(e) => setApplyVat(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600"
            />
            <span className="text-xs text-indigo-900 font-medium">
              Apply VAT (16%) to this PO
            </span>
          </label>
          <p className="text-[11px] text-indigo-700">
            {applyVat
              ? `VAT will be applied. Total: ${req.currency} ${gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `No VAT. Total: ${req.currency} ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void handleCreatePO()}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {actionBusy ? "Creating…" : "Confirm & create PO"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreatePOForm(false)}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white rounded-lg border border-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── two-column info cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* requisition meta */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 text-xs">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest mb-3">
            Requisition details
          </h2>
          <p><span className="text-slate-500">Requested by:</span> <span className="font-semibold text-slate-800">{req.requestedBy}</span></p>
          <p><span className="text-slate-500">Department:</span> {req.department ?? "—"}</p>
          <p><span className="text-slate-500">Source:</span> {sourceLabel[req.source ?? ""] ?? req.source ?? "—"}</p>
          <p><span className="text-slate-500">Required by:</span> {req.requiredByDate ? fmtDate(req.requiredByDate) : "—"}</p>
          <p><span className="text-slate-500">Currency:</span> {req.currency}</p>
          {req.approvedAt && (
            <p><span className="text-slate-500">Approved at:</span> {fmtDate(req.approvedAt)}</p>
          )}
          {req.justification && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Justification</p>
              <p className="text-slate-700 leading-relaxed">{req.justification}</p>
            </div>
          )}
        </div>

        {/* supplier info */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 text-xs">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest mb-3">
            Supplier
          </h2>
          {req.supplier ? (
            <>
              <p><span className="text-slate-500">Name:</span> <span className="font-semibold text-slate-800">{req.supplier.name}</span></p>
              <p><span className="text-slate-500">Code:</span> <span className="font-mono">{req.supplier.code}</span></p>
              <p><span className="text-slate-500">Tax PIN:</span> {req.supplier.taxPin ?? "—"}</p>
              <p><span className="text-slate-500">Phone:</span> {req.supplier.phone ?? "—"}</p>
              <p><span className="text-slate-500">Email:</span> {req.supplier.email ?? "—"}</p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.PROCUREMENT_SUPPLIER_DETAIL(req.supplier!.id))}
                className="mt-2 text-[10px] font-bold text-indigo-600 hover:underline"
              >
                View supplier profile →
              </button>
            </>
          ) : (
            <p className="text-slate-400">No supplier assigned yet.</p>
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
              <th className="px-5 py-3 text-left">Unit</th>
              <th className="px-5 py-3 text-right">Qty</th>
              <th className="px-5 py-3 text-right">Unit price</th>
              <th className="px-5 py-3 text-right">Line total</th>
              <th className="px-5 py-3 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {req.lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-5 py-3">
                  <p className="font-semibold text-slate-800">{line.itemProfile.name}</p>
                  <p className="text-[10px] font-mono text-slate-400">{line.itemProfile.sku}</p>
                </td>
                <td className="px-5 py-3 text-slate-500">{line.itemProfile.category.replace(/_/g, " ")}</td>
                <td className="px-5 py-3 text-slate-500">{line.itemProfile.unit}</td>
                <td className="px-5 py-3 text-right font-mono">{Number(line.quantity).toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono">
                  {line.unitPriceEstimate ? fmtMoney(line.unitPriceEstimate, req.currency) : "—"}
                </td>
                <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                  {line.lineTotalEstimate ? fmtMoney(line.lineTotalEstimate, req.currency) : "—"}
                </td>
                <td className="px-5 py-3 text-slate-500">{line.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals footer */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <div className="space-y-1 text-xs text-right min-w-[260px]">
            <div className="flex justify-between gap-8">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono font-semibold text-slate-700">{fmtMoney(subtotal, req.currency)}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-slate-500">{applyVat ? "VAT (16%)" : "VAT"}</span>
              <span className={`font-mono font-semibold ${applyVat ? "text-slate-700" : "text-slate-400"}`}>
                {applyVat ? fmtMoney(vat, req.currency) : "Not applied"}
              </span>
            </div>
            <div className="flex justify-between gap-8 pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-800">Gross total</span>
              <span className="font-mono font-black text-slate-900 text-sm">{fmtMoney(gross, req.currency)}</span>
            </div>
          </div>
        </div>
      </div>


      {/* ── approval history ─────────────────────────────────────────────── */}
      {req.approvals.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest">
            Approval history
          </h2>
          <div className="space-y-2">
            {req.approvals.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-xs ${
                  a.decision === "APPROVED"
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                {a.decision === "APPROVED"
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                }
                <div className="flex-1">
                  <p className="font-bold text-slate-800">
                    {a.decision} by {a.approverName}
                    <span className="ml-2 text-[10px] font-normal text-slate-500">
                      ({a.level.replace(/_/g, " ")})
                    </span>
                  </p>
                  {a.comments && <p className="text-slate-600 mt-0.5">{a.comments}</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(a.decidedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── linked purchase orders ───────────────────────────────────────── */}
      {req.purchaseOrders.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest">
            Purchase orders
          </h2>
          <div className="space-y-2">
            {req.purchaseOrders.map((po) => (
              <div key={po.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-xs bg-slate-50/50">
                <div>
                  <p className="font-mono font-bold text-slate-800">{po.poNumber}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Created {fmtDate(po.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-slate-700">{fmtMoney(po.totalAmount, po.currency)}</span>
                  <StatusBadge status={po.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── audit trail ──────────────────────────────────────────────────── */}
      {auditLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <button
            type="button"
            onClick={() => setAuditOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest flex-1">
              Audit trail ({auditLogs.length} events)
            </h2>
            {auditOpen
              ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            }
          </button>

          {auditOpen && (
            <div className="mt-4 space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 border-l-2 border-slate-200 pl-4 py-1 text-xs">
                  <div className="flex-1">
                    <p>
                      <span className="font-bold text-slate-800">{log.action.replace(/_/g, " ")}</span>
                      {log.actorName && (
                        <span className="text-slate-500"> by {log.actorName}</span>
                      )}
                      {log.afterState && (log.afterState as { status?: string }).status && (
                        <span className="ml-1.5 text-slate-400">
                          → <span className="font-mono">{(log.afterState as { status?: string }).status}</span>
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
