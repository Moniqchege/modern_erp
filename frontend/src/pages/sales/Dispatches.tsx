import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import { StatusBadge } from "../../modules/sales/components/StatusBadge";
import type { DispatchLog } from "../../modules/sales/types/sales";

export function Dispatches() {
  const navigate = useNavigate();
  const [dispatches, setDispatches] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await salesApi.dispatches.list({
          status: statusFilter || undefined,
        });
        setDispatches(data.dispatches ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h1 className="text-xl font-black">Dispatch & delivery</h1>
          <p className="text-xs text-slate-500">Customer truck loads and delivery tracking</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.SALES_DISPATCH_NEW)}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
        >
          <Plus className="h-4 w-4" /> New dispatch
        </button>
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="border rounded-lg text-xs px-3 py-2"
      >
        <option value="">All</option>
        <option value="PENDING">Pending</option>
        <option value="LOADED">Loaded</option>
        <option value="IN_TRANSIT">In transit</option>
        <option value="DELIVERED">Delivered</option>
      </select>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="bg-white border rounded-2xl divide-y">
          {dispatches.map((d) => (
            <Link
              key={d.id}
              to={ROUTES.SALES_DISPATCH_DETAIL(d.id)}
              className="block px-5 py-4 hover:bg-slate-50"
            >
              <div className="flex justify-between">
                <div>
                  <p className="text-xs font-bold">{d.dispatchNumber}</p>
                  <p className="text-[10px] text-slate-500">{d.customer?.name}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {d.truckRegistration} · {d.driverName}
                  </p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
