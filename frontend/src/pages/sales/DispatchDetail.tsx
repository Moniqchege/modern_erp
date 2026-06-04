import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { DispatchLog, DispatchStatus } from "../../modules/sales/types/sales";

const NEXT_STATUS: Partial<Record<DispatchStatus, DispatchStatus>> = {
  PENDING: "LOADED",
  LOADED: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

export function DispatchDetail() {
  const { dispatchId } = useParams<{ dispatchId: string }>();
  const navigate = useNavigate();
  const [dispatch, setDispatch] = useState<DispatchLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!dispatchId) return;
    const data = await salesApi.dispatches.get(dispatchId);
    setDispatch(data.dispatch);
  };

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchId]);

  const advance = async () => {
    if (!dispatch) return;
    const next = NEXT_STATUS[dispatch.status];
    if (!next) return;
    setBusy(true);
    try {
      await salesApi.dispatches.updateStatus(dispatch.id, { status: next });
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading || !dispatch) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const next = NEXT_STATUS[dispatch.status];

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(ROUTES.SALES_DISPATCHES)}
        className="flex items-center gap-2 text-xs font-bold text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Dispatches
      </button>
      <div className="bg-white border rounded-2xl p-6 space-y-4">
        <div className="flex justify-between">
          <h1 className="text-xl font-black">{dispatch.dispatchNumber}</h1>
          <StatusBadge status={dispatch.status} />
        </div>
        <p className="text-sm text-slate-600">{dispatch.customer?.name}</p>
        <div className="text-xs space-y-1 text-slate-600">
          <p>
            <span className="font-bold">Truck:</span> {dispatch.truckRegistration}
          </p>
          <p>
            <span className="font-bold">Driver:</span> {dispatch.driverName}
            {dispatch.driverPhone ? ` (${dispatch.driverPhone})` : ""}
          </p>
          <p>
            <span className="font-bold">Address:</span> {dispatch.deliveryAddress}
          </p>
          {dispatch.items.length > 0 && (
            <p>
              <span className="font-bold">Pallets:</span> {dispatch.items.length} loaded
            </p>
          )}
        </div>
        {next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void advance()}
            className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
          >
            {busy ? "Updating…" : `Mark ${next.replace(/_/g, " ").toLowerCase()}`}
          </button>
        )}
      </div>
    </div>
  );
}
