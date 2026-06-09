/**
 * Right-side "pending ticket queue" used by all three weighing screens.
 * Shows all tickets in PENDING state so the operator can resume a Step-2
 * capture without leaving the page.
 */
import React, { useEffect, useState } from "react";
import { Loader2, ListChecks, ArrowRight, X } from "lucide-react";
import { weighbridgeApi } from "../api";
import type { PendingTicketSummary, WeighbridgeTicketRecord } from "../types";
import { fmtKg, fmtDate, statusBadgeClass, ticketTypeLabel } from "../format";

interface PendingQueueProps {
  type?: "PURCHASE" | "SALE" | "OTHERS";
  onResume: (ticket: PendingTicketSummary) => void;
  refreshKey?: number;
}

export function PendingQueue({ type, onResume, refreshKey }: PendingQueueProps) {
  const [items, setItems] = useState<PendingTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    weighbridgeApi.tickets
      .pending()
      .then((res) => {
        if (!alive) return;
        const list = (res.data ?? []).filter(
          (p) => !type || p.type === type
        );
        setItems(list);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load queue");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [type, refreshKey]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-indigo-500" />
          <h3 className="text-xs font-bold text-slate-800">Pending Queue</h3>
        </div>
        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
          {items.length} open
        </span>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-xs text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-xs text-slate-400 italic text-center">
            No pending tickets. Start a new one with Capture First Weight.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((t) => (
              <li
                key={t.id}
                className="px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold text-slate-900 truncate">
                      {t.ticketNumber}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold mr-1.5 ${
                          t.type === "PURCHASE"
                            ? "bg-emerald-100 text-emerald-700"
                            : t.type === "SALE"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {ticketTypeLabel(t.type)}
                      </span>
                      {t.supplierOrCustomer ?? "—"}
                      <span className="ml-2 font-mono text-[10px] text-slate-600">
                        • {t.vehiclePlate ?? t.truckLicensePlate ?? "No plate"}
                      </span>
                    </p>
                    <div className="mt-1">
                      <p className="text-[10px] text-slate-400">
                           First weight: <span className="font-bold text-slate-700">{fmtKg(t.firstWeightKg)}</span>
                       </p>

                      <p className="text-[10px] text-slate-400">
                          {fmtDate(t.createdAt)}
                       </p>
                    </div>
                    
                  </div>
                  <button
                    type="button"
                    onClick={() => onResume(t)}
                    className="shrink-0 inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2 py-1 rounded-md"
                    title="Resume Step 2"
                  >
                    Resume <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Tiny "cancel ticket" helper.
 */
export async function cancelTicketApi(ticketId: string, reason: string) {
  return weighbridgeApi.tickets.cancel(ticketId, { reason });
}

/**
 * Banner shown at the top of a screen when resuming a Step-2 ticket.
 */
export function ResumeBanner({
  ticket,
  onClear,
}: {
  ticket: WeighbridgeTicketRecord;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs">
      <div>
        <span className="font-extrabold">Resuming ticket:</span>{" "}
        <span className="font-mono">{ticket.ticketNumber}</span>{" "}
        <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${statusBadgeClass(ticket.status)}`}>
          {ticket.status}
        </span>
        <span className="ml-3 text-amber-700">
          First weight already captured: <strong>{fmtKg(ticket.firstWeightKg)}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="p-1 rounded hover:bg-amber-100"
        title="Start a new ticket instead"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
