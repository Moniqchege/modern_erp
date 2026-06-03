import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Plus,
  CheckCircle2,
  Truck,
  XCircle,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { apiFetch, decodeJwtPayload } from "../../api/apiClient";
import { getAccessToken } from "../../auth/authClient";

type TransferStatus =
  | "PENDING"
  | "APPROVED_IN_TRANSIT"
  | "COMPLETED"
  | "REJECTED"
  | "RECEIPT_REJECTED"
  | "PENDING_CORRECTION";

type TransferLine = {
  id: string;
  qtyRequested: number;
  qtyIssued: number | null;
  qtyReceived: number | null;
  item: { sku: string; name: string; unit: string };
};

type StockTransfer = {
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

const STATUS_META: Record<
  TransferStatus,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: "Pending approval",
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
  RECEIPT_REJECTED: {
    label: "Delivery rejected",
    className: "text-orange-600 bg-orange-50 border border-orange-200",
    icon: XCircle,
  },
  PENDING_CORRECTION: {
    label: "Awaiting correction",
    className: "text-orange-600 bg-orange-50 border border-orange-200",
    icon: AlertTriangle,
  },
};

export function StockTransfers() {
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = useMemo(() => {
    const token = getAccessToken();
    if (!token) return "";
    const payload = decodeJwtPayload<{ role?: string }>(token);
    return payload?.role ?? role;
  }, [role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/stock-transfers");
      if (res.status === 401) { setError("Session expired. Please log in again."); return; }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setTransfers(json.transfers ?? []);
      setRole(json.role ?? userRole);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transfers");
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => { load(); }, [load]);

  const effectiveRole = userRole || role;

  // Bucket counts for attention indicators
  const pendingCount = transfers.filter(
    (t) => t.status === "PENDING" || t.status === "PENDING_CORRECTION"
  ).length;
  const inTransitCount = transfers.filter(
    (t) => t.status === "APPROVED_IN_TRANSIT"
  ).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Stock Transfers</h1>
          <p className="text-xs text-slate-500 mt-1">
            Role: <span className="font-bold">{effectiveRole || "—"}</span>
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-bold">
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFER_NEW)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff7d12] text-white text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" />
            New request
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading transfers…
        </div>
      ) : transfers.length === 0 ? (
        <p className="text-sm text-slate-500">No stock transfer requests yet.</p>
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
                onClick={() => navigate(ROUTES.INVENTORY_STOCK_TRANSFER_DETAIL(t.id))}
                className={`w-full text-left bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group ${
                  needsAttention ? "border-amber-200" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
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

                    <ul className="mt-2 text-xs text-slate-600 space-y-0.5">
                      {t.items.map((line) => (
                        <li key={line.id}>
                          <span className="font-medium">{line.item.name}</span>
                          {" — "}req {line.qtyRequested}
                          {line.qtyIssued != null && (
                            <span className={line.qtyIssued < line.qtyRequested - 0.0005 ? " text-amber-600 font-bold" : ""}>
                              {" · "}issued {line.qtyIssued}
                            </span>
                          )}
                          {line.qtyReceived != null && ` · received ${line.qtyReceived}`}
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
                      <p className="mt-2 text-[10px] text-rose-600">
                        {t.rejectionReason}
                      </p>
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
