import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { apiFetch, decodeJwtPayload } from "../../api/apiClient";
import { getAccessToken } from "../../auth/authClient";

type TransferStatus =
  | "PENDING"
  | "APPROVED_IN_TRANSIT"
  | "COMPLETED"
  | "REJECTED";

type TransferLine = {
  id: string;
  itemId: string;
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
  sourceLocation: { code: string; name: string };
  destinationLocation: { code: string; name: string };
  items: TransferLine[];
  requestedBy: { name: string; role: string };
};

const STATUS_LABEL: Record<TransferStatus, string> = {
  PENDING: "Pending approval",
  APPROVED_IN_TRANSIT: "In transit",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

const STATUS_META: Record<
  TransferStatus,
  {
    label: string;
    className: string;
    icon?: React.ComponentType<{ className?: string }>;
  }
> = {
  PENDING: {
    label: "Pending approval",
    className: "text-amber-400 border border-amber-200",
    icon: RefreshCw,
  },
  APPROVED_IN_TRANSIT: {
    label: "In transit",
    className: "text-blue-400 border border-blue-200",
    icon: Truck,
  },
  COMPLETED: {
    label: "Completed",
    className: "text-emerald-400 border border-emerald-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    className: "text-rose-400 border border-rose-200",
    icon: XCircle,
  },
};

function canApprove(role: string) {
  return (
    role === "SUPERADMIN" ||
    role === "ADMIN" ||
    role === "MAIN_STORE_MANAGER"
  );
}

function canReceive(role: string, dest: string) {
  if (role === "SUPERADMIN" || role === "ADMIN") return true;
  // Legacy role mapping
  const map: Record<string, string> = {
    MAIZE_STORE_MANAGER: "MAIZE_STORE",
    PACKAGING_STORE_MANAGER: "PACKAGING_STORE",
    DISPATCH_STORE_MANAGER: "DISPATCH_STORE",
  };
  return map[role] === dest;
}

export function StockTransfers() {
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

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
      if (res.status === 401) {
        setError("Session expired. Please log in again.");
        return;
      }
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

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (
    id: string,
    path: string,
    body?: unknown
  ) => {
    setActionId(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/stock-transfers/${id}/${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Action failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionId(null);
    }
  };

  const handleApprove = (t: StockTransfer) => {
    const lines = t.items.map((line) => ({
      lineId: line.id,
      qtyIssued: line.qtyRequested,
    }));
    void runAction(t.id, "approve-issue", { lines });
  };

  const handleReceive = (t: StockTransfer) => {
    const lines = t.items.map((line) => ({
      lineId: line.id,
      qtyReceived: line.qtyIssued ?? line.qtyRequested,
    }));
    void runAction(t.id, "receive", { lines });
  };

  const handleReject = (t: StockTransfer) => {
    const reason = window.prompt("Rejection reason (optional)") ?? undefined;
    void runAction(t.id, "reject", { rejectionReason: reason });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Stock Transfers</h1>
            <p className="text-xs text-slate-500 mt-1">
              Request → Approve &amp; issue → Receive (role: {userRole || role || "—"})
            </p>
          </div>
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
        <div className="space-y-4">
          {transfers.map((t) => {
            const statusMeta = STATUS_META[t.status];
            const StatusIcon = statusMeta.icon;
            return (
            <article
              key={t.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                <div>
                  <span className="font-mono text-sm font-bold text-slate-800">
                    {t.requestNumber}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {t.sourceLocation.name} → {t.destinationLocation.name} ·{" "}
                    {t.requestedBy.name}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusMeta.className}`}>
                  {StatusIcon && <StatusIcon className="h-3 w-3" />}
                  {statusMeta.label}
                </span>
              </div>

              <ul className="text-xs text-slate-600 space-y-1 mb-4">
                {t.items.map((line) => (
                  <li key={line.id}>
                    {line.item.name} — req {line.qtyRequested}
                    {line.qtyIssued != null && ` · issued ${line.qtyIssued}`}
                    {line.qtyReceived != null &&
                      ` · received ${line.qtyReceived}`}{" "}
                    {line.item.unit}
                  </li>
                ))}
              </ul>

              {t.rejectionReason && (
                <p className="text-[10px] text-rose-600 mb-3">{t.rejectionReason}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {t.status === "PENDING" && canApprove(userRole || role) && (
                  <>
                    <button
                      type="button"
                      disabled={actionId === t.id}
                      onClick={() => handleApprove(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold disabled:opacity-50"
                    >
                      <Truck className="h-3 w-3" />
                      Approve &amp; issue
                    </button>
                    <button
                      type="button"
                      disabled={actionId === t.id}
                      onClick={() => handleReject(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-[10px] font-bold"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </button>
                  </>
                )}
                {t.status === "APPROVED_IN_TRANSIT" &&
                  canReceive(
                    userRole || role,
                    t.destinationLocation.code
                  ) && (
                    <button
                      type="button"
                      disabled={actionId === t.id}
                      onClick={() => handleReceive(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold disabled:opacity-50"
                    >
                      <PackageCheck className="h-3 w-3" />
                      Acknowledge receipt
                    </button>
                  )}
                {t.status === "COMPLETED" && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Closed
                  </span>
                )}
              </div>
            </article>
            )
          })}
        </div>
      )}
    </div>
  );
}
