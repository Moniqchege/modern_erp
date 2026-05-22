import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Loader2, Calendar, Download } from "lucide-react";
import { ROUTES } from "../../app/router/routes";

interface ReportMeta {
  id: string;
  label: string;
  description: string;
}

export function InventoryReports() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/inventory/reports");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.reports)) setReports(data.reports);
        }
      } catch {
        setError("Could not load report types.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const needsDateRange = (id: string) =>
    id === "movement-ledger" || id === "packaging-runs";

  const handleDownload = async (reportId: string) => {
    setDownloading(reportId);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (needsDateRange(reportId)) {
        params.set("from", from);
        params.set("to", to);
      }
      const qs = params.toString();
      const url = `/api/inventory/reports/${reportId}${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message ?? "Export failed.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `inventory-${reportId}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("Network error during export.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          to={ROUTES.INVENTORY}
          title="Inventory dashboard"
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventory Reports</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Export Excel workbooks for stock, movements, and packaging.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
          />
        </div>
        <p className="text-[10px] text-slate-400 font-medium pb-1">
          Date range applies to movement ledger and packaging runs.
        </p>
      </div>

      {error && (
        <div className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{r.label}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">{r.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(r.id)}
                disabled={downloading === r.id}
                className="flex items-center gap-2 shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all"
              >
                {downloading === r.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Excel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
