import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, Download, FileSpreadsheet, Loader2,
} from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { getAccessToken } from "../../auth/authClient";

// ─── types ───────────────────────────────────────────────────────────────────

interface ReportMeta {
  id: string;
  label: string;
  description: string;
  dateRange: boolean;
}

// ─── groups ──────────────────────────────────────────────────────────────────

const GROUPS: Array<{
  label: string;
  color: string;
  ids: string[];
}> = [
  {
    label: "Suppliers",
    color: "emerald",
    ids: ["supplier-directory", "supplier-compliance"],
  },
  {
    label: "Purchasing",
    color: "sky",
    ids: ["requisitions", "purchase-orders", "po-line-items"],
  },
  {
    label: "Receiving",
    color: "amber",
    ids: ["grn-register"],
  },
  {
    label: "Finance & spend",
    color: "indigo",
    ids: ["spend-by-supplier", "three-way-match", "payment-vouchers"],
  },
];

const GROUP_STYLES: Record<string, { badge: string; icon: string; btn: string }> = {
  emerald: {
    badge: "bg-emerald-50 border-emerald-200 text-emerald-700",
    icon: "bg-emerald-50 text-emerald-700 border-emerald-100",
    btn: "bg-emerald-600 hover:bg-emerald-700",
  },
  sky: {
    badge: "bg-sky-50 border-sky-200 text-sky-700",
    icon: "bg-sky-50 text-sky-700 border-sky-100",
    btn: "bg-sky-600 hover:bg-sky-700",
  },
  amber: {
    badge: "bg-amber-50 border-amber-200 text-amber-700",
    icon: "bg-amber-50 text-amber-700 border-amber-100",
    btn: "bg-amber-600 hover:bg-amber-700",
  },
  indigo: {
    badge: "bg-indigo-50 border-indigo-200 text-indigo-700",
    icon: "bg-indigo-50 text-indigo-700 border-indigo-100",
    btn: "bg-indigo-600 hover:bg-indigo-700",
  },
};

// ─── component ───────────────────────────────────────────────────────────────

export function ProcurementReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/procurement/reports");
        if (res.ok) {
          const data = await res.json() as { reports: ReportMeta[] };
          if (Array.isArray(data.reports)) setReports(data.reports);
        }
      } catch {
        setError("Could not load report types.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDownload = async (reportId: string) => {
    setDownloading(reportId);
    setError(null);
    try {
      const meta = reports.find((r) => r.id === reportId);
      const params = new URLSearchParams();
      if (meta?.dateRange) {
        params.set("from", from);
        params.set("to", to);
      }
      const qs = params.toString();
      const url = `/api/procurement/reports/${reportId}${qs ? `?${qs}` : ""}`;

      const token = getAccessToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setError(err.message ?? "Export failed.");
        return;
      }

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `procurement-${reportId}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("Network error during export.");
    } finally {
      setDownloading(null);
    }
  };

  // build a lookup from id → group color
  const idToColor = Object.fromEntries(
    GROUPS.flatMap((g) => g.ids.map((id) => [id, g.color]))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">

      {/* ── header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.PROCUREMENT)}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
          aria-label="Back to procurement dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Procurement reports
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Export Excel workbooks covering suppliers, POs, GRNs, spend and finance.
          </p>
        </div>
      </div>

      {/* ── date range picker ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-400"
          />
        </div>
        <p className="text-[10px] text-slate-400 font-medium pb-1">
          Date range applies to all reports marked with a calendar icon.
          Supplier directory and compliance docs export all records regardless of date.
        </p>
      </div>

      {/* ── error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-4 py-2.5 rounded-lg">
          {error}
        </div>
      )}

      {/* ── report groups ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const groupReports = reports.filter((r) => group.ids.includes(r.id));
            if (groupReports.length === 0) return null;
            const styles = GROUP_STYLES[group.color];
            return (
              <div key={group.label}>
                {/* group label */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wide mb-3 ${styles.badge}`}>
                  {group.label}
                </div>

                {/* report cards */}
                <div className="space-y-2">
                  {groupReports.map((r) => {
                    const color = idToColor[r.id] ?? "emerald";
                    const s = GROUP_STYLES[color];
                    return (
                      <div
                        key={r.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg border ${s.icon} shrink-0`}>
                            <FileSpreadsheet className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{r.label}</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">{r.description}</p>
                            {r.dateRange && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-slate-400">
                                <Calendar className="h-2.5 w-2.5" /> Uses date range
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleDownload(r.id)}
                          disabled={downloading === r.id}
                          className={`flex items-center gap-2 shrink-0 ${s.btn} disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all`}
                        >
                          {downloading === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          Excel
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
