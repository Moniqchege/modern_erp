import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Plus,
  RefreshCw,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
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
  qtyRequested: number;
  qtyIssued: number | null;
  qtyReceived: number | null;
  item: { sku: string; name: string; unit: string };
};

type BaleTransfer = {
  id: string;
  requestNumber: string;
  status: TransferStatus;
  notes: string | null;
  rejectionReason: string | null;
  receiptRejectionReason: string | null;
  sourceLocation: { code: string; name: string };
  destinationLocation: { code: string; name: string };
  items: TransferLine[];
  requestedBy: { name: string; role: string };
  createdAt: string;
};

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<
  TransferStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: "Pending",
    className: "text-amber-600 bg-amber-50 border border-amber-200",
    icon: RefreshCw,
  },
  APPROVED_IN_TRANSIT: {
    label: "In transit",
    className: "text-blue-600 bg-blue-50 border border-blue-200",
    icon: Truck,
  },
  COMPLETED: {
    label: "Completed",
    className: "text-emerald-600 bg-emerald-50 border border-emerald-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    className: "text-rose-600 bg-rose-50 border border-rose-200",
    icon: XCircle,
  },
  PENDING_CORRECTION: {
    label: "Needs correction",
    className: "text-orange-600 bg-orange-50 border border-orange-200",
    icon: AlertTriangle,
  },
};

const ALL_STATUSES: TransferStatus[] = [
  "PENDING",
  "APPROVED_IN_TRANSIT",
  "COMPLETED",
  "REJECTED",
  "PENDING_CORRECTION",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function BaleTransfers() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = user?.role ?? "";

  const isPackagingManager =
    role === "PACKAGING_STORE_MANAGER" || role === "ADMIN" || role === "SUPERADMIN";
  const isDispatchManager =
    role === "DISPATCH_STORE_MANAGER" || role === "ADMIN" || role === "SUPERADMIN";

  const [transfers, setTransfers] = useState<BaleTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res = await apiFetch(`/api/bale-transfers${qs}`);
      if (res.status === 401) { setError("Session expired."); return; }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setTransfers(json.transfers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bale transfers");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const pendingCount = transfers.filter(
    (t) => t.status === "PENDING" || t.status === "PENDING_CORRECTION"
  ).length;
  const inTransitCount = transfers.filter((t) => t.status === "APPROVED_IN_TRANSIT").length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Bale Transfers</h1>
          <p className="text-xs text-slate-500 mt-1">
            Packaging Store → Dispatch Store
            {pendingCount > 0 && (
              <span className="ml-2 text-amber-600 font-bold">
                · {pendingCount} need{pendingCount === 1 ? "s" : ""} attention
              </span>
            )}
            {inTransitCount > 0 && (
              <span className="ml-2 text-blue-600 font-bold">
                · {inTransitCount} in transit
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

          {/* Push: Packaging → Dispatch (no request needed) */}
          {isPackagingManager && (
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.INVENTORY_BALE_TRANSFERS}/push`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold"
            >
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              Push to Dispatch
            </button>
          )}

          {/* Pull: Dispatch requests from Packaging */}
          {isDispatchManager && (
            <button
              type="button"
              onClick={() => navigate(`${ROUTES.INVENTORY_BALE_TRANSFERS}/pull`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff7d12] text-white text-xs font-bold"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Request from Packaging
            </button>
          )}
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
            statusFilter === ""
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          All
        </button>
        {ALL_STATUSES.map((s) => {
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                statusFilter === s ? meta.className : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading bale transfers…
        </div>
      ) : transfers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Truck className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-700">No bale transfers yet</p>
          <p className="text-xs text-slate-400 mt-1">
            {isPackagingManager
              ? 'Use "Push to Dispatch" to move bales, or wait for Dispatch to request them.'
              : 'Use "Request from Packaging" to request bales.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => {
            const meta = STATUS_META[t.status] ?? STATUS_META.PENDING;
            const StatusIcon = meta.icon;
            const needsAttention =
              t.status === "PENDING" || t.status === "PENDING_CORRECTION";

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(ROUTES.INVENTORY_BALE_TRANSFER_DETAIL(t.id))}
                className={`w-full text-left bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group ${
                  needsAttention ? "border-amber-200" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-black text-slate-800">
                        {t.requestNumber}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500">
                      {t.sourceLocation.name} → {t.destinationLocation.name}
                      {" · "}{t.requestedBy.name}
                      {" · "}{new Date(t.createdAt).toLocaleDateString()}
                    </p>

                    <ul className="mt-2 space-y-0.5">
                      {t.items.map((line) => (
                        <li key={line.id} className="text-xs text-slate-600">
                          <span className="font-medium">{line.item.name}</span>
                          {" — "}
                          <span>req {line.qtyRequested}</span>
                          {line.qtyIssued != null && (
                            <span
                              className={
                                line.qtyIssued < line.qtyRequested - 0.0005
                                  ? " text-amber-600 font-bold"
                                  : ""
                              }
                            >
                              {" · "}issued {line.qtyIssued}
                            </span>
                          )}
                          {line.qtyReceived != null && (
                            <span> · received {line.qtyReceived}</span>
                          )}
                          {" "}{line.item.unit}
                        </li>
                      ))}
                    </ul>

                    {t.status === "PENDING_CORRECTION" && t.receiptRejectionReason && (
                      <p className="mt-2 text-[10px] text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-1">
                        <span className="font-bold">Returned: </span>
                        {t.receiptRejectionReason}
                      </p>
                    )}
                    {t.status === "REJECTED" && t.rejectionReason && (
                      <p className="mt-2 text-[10px] text-rose-600">{t.rejectionReason}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
