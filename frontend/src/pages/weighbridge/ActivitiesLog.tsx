import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Search,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  X,
} from "lucide-react";
import { weighbridgeApi } from "../../modules/weighbridge/api";
import type {
  WeighbridgeTicketFilters,
  WeighbridgeTicketRecord,
  WeighbridgeTicketStatus,
  WeighbridgeTicketType,
} from "../../modules/weighbridge/types";
import {
  fmtDate,
  fmtKg,
  fmtMoney,
  statusBadgeClass,
  ticketTypeLabel,
} from "../../modules/weighbridge/format";

const ENTITY_MAP: Record<string, string> = {
  amp: "amp" + ";",
  lt: "lt" + ";",
  gt: "gt" + ";",
  quot: "quot" + ";",
  apos: "apos" + ";",
};
function xmlEscape(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&" + ENTITY_MAP.amp)
    .replace(/</g, "<" + ENTITY_MAP.lt)
    .replace(/>/g, ">" + ENTITY_MAP.gt)
    .replace(/"/g, '"' + ENTITY_MAP.quot);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TYPES: { v: "" | WeighbridgeTicketType; l: string }[] = [
  { v: "", l: "All types" },
  { v: "PURCHASE", l: "Purchases" },
  { v: "SALE", l: "Sales" },
  { v: "OTHERS", l: "Others" },
];
const STATUSES: { v: "" | WeighbridgeTicketStatus; l: string }[] = [
  { v: "", l: "All statuses" },
  { v: "PENDING", l: "Pending" },
  { v: "COMPLETED", l: "Completed" },
  { v: "CANCELLED", l: "Cancelled" },
];
const MANUAL_OPTS: { v: "" | "true" | "false"; l: string }[] = [
  { v: "", l: "All entries" },
  { v: "true", l: "Manual only" },
  { v: "false", l: "Scale only" },
];

export function ActivitiesLog() {
  const [tickets, setTickets] = useState<WeighbridgeTicketRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | WeighbridgeTicketStatus>("");
  const [type, setType] = useState<"" | WeighbridgeTicketType>("");
  const [isManual, setIsManual] = useState<"" | "true" | "false">("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const [searchDebounced, setSearchDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo<WeighbridgeTicketFilters>(
    () => ({
      status: status || undefined,
      type: type || undefined,
      isManual: isManual === "" ? undefined : isManual === "true",
      vehiclePlate: (searchDebounced || vehiclePlate).trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit,
    }),
    [status, type, isManual, vehiclePlate, searchDebounced, dateFrom, dateTo, page]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    weighbridgeApi.tickets
      .list(filters)
      .then((res) => {
        if (!alive) return;
        setTickets(res.data.tickets);
        setTotal(res.data.total);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load tickets");
        setTickets([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filters]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function rowsForExport(): string[][] {
    return tickets.map((t) => [
      t.ticketNumber,
      ticketTypeLabel(t.type),
      t.status,
      t.supplierName ?? t.customerName ?? "",
      t.vehiclePlate ?? t.truckMaster?.licensePlate ?? "",
      t.driverName ?? t.assignedDriverName ?? "",
      t.firstWeightKg != null ? String(t.firstWeightKg) : "",
      t.secondWeightKg != null ? String(t.secondWeightKg) : "",
      t.netWeightKg != null ? String(t.netWeightKg) : "",
      t.amountCharged != null ? String(t.amountCharged) : "",
      t.paymentMethod ?? "",
      t.receiptReference ?? "",
      t.isManual ? "YES" : "",
      t.varianceFlagged
        ? "YES (" + (t.tareVarianceKg ?? 0) + " kg)"
        : "",
      t.operatorName ?? "",
      t.createdAt,
      t.completedAt ?? "",
    ]);
  }

  function exportCsv() {
    const headers = [
      "Ticket",
      "Type",
      "Status",
      "Party",
      "Plate",
      "Driver",
      "First kg",
      "Second kg",
      "Net kg",
      "Amount",
      "Pay Method",
      "Receipt #",
      "Manual",
      "Tare Variance",
      "Operator",
      "Created",
      "Completed",
    ];
    const rows = rowsForExport();
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? "").replace(/"/g, '""');
            return /[",\n]/.test(s) ? '"' + s + '"' : s;
          })
          .join(",")
      )
      .join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      "weighbridge-log-" + new Date().toISOString().slice(0, 10) + ".csv"
    );
  }

  function exportExcel() {
    const headers = [
      "Ticket",
      "Type",
      "Status",
      "Party",
      "Plate",
      "Driver",
      "First kg",
      "Second kg",
      "Net kg",
      "Amount",
      "Pay Method",
      "Receipt",
      "Manual",
      "Tare Variance",
      "Operator",
      "Created",
      "Completed",
    ];
    const rows = rowsForExport();

    const headerRow =
      "<Row>" +
      headers
        .map(
          (h) =>
            '<Cell ss:StyleID="Header"><Data ss:Type="String">' +
            xmlEscape(h) +
            "</Data></Cell>"
        )
        .join("") +
      "</Row>";

    const dataRows = rows
      .map((r) => {
        const isMan = r[12] === "YES";
        const styleId = isMan ? ' ss:StyleID="Manual"' : "";
        return (
          "<Row" +
          styleId +
          ">" +
          r
            .map(
              (c) =>
                "<Cell><Data ss:Type=\"String\">" +
                xmlEscape(c) +
                "</Data></Cell>"
            )
            .join("") +
          "</Row>"
        );
      })
      .join("");

    const xml =
      '<?xml version="1.0"?>\n' +
      '<?mso-application progid="Excel.Sheet"?>\n' +
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
      '          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n' +
      "  <Styles>\n" +
      '    <Style ss:ID="Header">\n' +
      '      <Font ss:Bold="1"/>\n' +
      '      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>\n' +
      "    </Style>\n" +
      '    <Style ss:ID="Manual">\n' +
      '      <Interior ss:Color="#FFE4E6" ss:Pattern="Solid"/>\n' +
      '      <Font ss:Color="#9F1239" ss:Bold="1"/>\n' +
      "    </Style>\n" +
      "  </Styles>\n" +
      '  <Worksheet ss:Name="Tickets">\n' +
      "    <Table>\n" +
      "      " +
      headerRow +
      "\n" +
      "      " +
      dataRows +
      "\n" +
      "    </Table>\n" +
      "  </Worksheet>\n" +
      "</Workbook>";

    downloadBlob(
      new Blob([xml], { type: "application/vnd.ms-excel" }),
      "weighbridge-log-" + new Date().toISOString().slice(0, 10) + ".xls"
    );
  }

  function clearFilters() {
    setSearch("");
    setStatus("");
    setType("");
    setIsManual("");
    setVehiclePlate("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6 pb-15">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-rose-600" />
            Activities Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {total.toLocaleString()} tickets · manual entries highlighted in red
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!tickets.length}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            <FileText className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={!tickets.length}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="KAA 123A, supplier name, ticket #…"
                className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
                style={{ paddingLeft: 28 }}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "" | WeighbridgeTicketType)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              {TYPES.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | WeighbridgeTicketStatus)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              {STATUSES.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase">Source</label>
            <select
              value={isManual}
              onChange={(e) => setIsManual(e.target.value as "" | "true" | "false")}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              {MANUAL_OPTS.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase">Plate</label>
            <input
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              placeholder="KAA…"
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 mb-1 uppercase">Date range</label>
            <div className="flex gap-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs px-4 py-3">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-4 py-12 text-xs text-slate-400 italic text-center">
            No tickets match the current filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Ticket</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Party</th>
                    <th className="px-3 py-2 text-left">Plate / Driver</th>
                    <th className="px-3 py-2 text-right">First</th>
                    <th className="px-3 py-2 text-right">Second</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Manual</th>
                    <th className="px-3 py-2 text-left">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.map((t) => (
                    <tr
                      key={t.id}
                      className={
                        t.isManual
                          ? "bg-rose-50 text-rose-900 hover:bg-rose-100/80"
                          : "hover:bg-slate-50"
                      }
                    >
                      <td className="px-3 py-2 font-mono font-bold whitespace-nowrap">
                        {t.ticketNumber}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={
                            "px-1.5 py-0.5 rounded text-[10px] font-extrabold " +
                            (t.type === "PURCHASE"
                              ? "bg-emerald-100 text-emerald-700"
                              : t.type === "SALE"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-amber-100 text-amber-700")
                          }
                        >
                          {ticketTypeLabel(t.type)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={
                            "px-2 py-0.5 rounded-full text-[10px] font-extrabold " +
                            statusBadgeClass(t.status)
                          }
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700 max-w-[180px] truncate">
                        {t.supplierName ?? t.customerName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {t.vehiclePlate ?? t.truckMaster?.licensePlate ?? "—"}
                        {t.driverName || t.assignedDriverName ? (
                          <span className="text-slate-400">
                            {" · "}
                            {t.driverName ?? t.assignedDriverName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmtKg(t.firstWeightKg, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtKg(t.secondWeightKg, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{fmtKg(t.netWeightKg, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono">{t.amountCharged != null ? fmtMoney(t.amountCharged, "", 0) : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {t.isManual ? (
                          <span className="bg-rose-600 text-white px-1.5 py-0.5 rounded text-[9px] font-extrabold">
                            MANUAL
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">scale</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
              <span>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50"
                >
                  ‹ Prev
                </button>
                <span className="px-2.5 py-1 text-slate-700 font-bold">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50"
                >
                  Next ›
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export { ActivitiesLog as default };
