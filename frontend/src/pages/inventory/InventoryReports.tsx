import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Loader2, Calendar, Download, ChevronDown } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { apiFetch } from "../../api/apiClient";
import { getCurrentUser } from "../../auth/authClient";

interface ReportMeta { id: string; label: string; description: string }
type Store = { id: string; code: string; name: string; isActive: boolean };

export function InventoryReports() {
  const user = getCurrentUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Date range
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Store filter
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreCode, setSelectedStoreCode] = useState<string | null>(null);

  // Non-admin: their own store
  const [myStoreCode, setMyStoreCode] = useState<string | null>(null);
  const [myStoreName, setMyStoreName] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/inventory/reports")
      .then((r) => r.json())
      .then((d: { reports: ReportMeta[] }) => { if (Array.isArray(d.reports)) setReports(d.reports); })
      .catch(() => setError("Could not load report types."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      apiFetch("/api/stores/me")
        .then((r) => r.json())
        .then((j: { storeCode: string | null; store?: { name: string } | null }) => {
          setMyStoreCode(j.storeCode);
          setMyStoreName(j.store?.name ?? null);
        })
        .catch(() => null);
      return;
    }
    apiFetch("/api/stores")
      .then((r) => r.json())
      .then((j: { stores: Store[] }) => setStores((j.stores ?? []).filter((s) => s.isActive)))
      .catch(() => null);
  }, [isAdmin]);

  const effectiveStoreCode = isAdmin ? selectedStoreCode : myStoreCode;

  const needsDateRange = (id: string) => id === "movement-ledger" || id === "packaging-runs";

  const handleDownload = async (reportId: string) => {
    setDownloading(reportId);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (needsDateRange(reportId)) { params.set("from", from); params.set("to", to); }
      if (effectiveStoreCode) params.set("storeCode", effectiveStoreCode);
      const qs = params.toString();
      const url = `/api/inventory/reports/${reportId}${qs ? `?${qs}` : ""}`;
      const res = await apiFetch(url);
      if (!res.ok) { const err = await res.json().catch(() => ({})); setError((err as { message?: string }).message ?? "Export failed."); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const storeTag = effectiveStoreCode ? `-${effectiveStoreCode}` : "";
      a.download = `inventory-${reportId}${storeTag}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { setError("Network error during export."); }
    finally { setDownloading(null); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={ROUTES.INVENTORY} title="Inventory dashboard"
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventory Reports</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {effectiveStoreCode
              ? `Scoped to: ${isAdmin ? (stores.find((s) => s.code === effectiveStoreCode)?.name ?? effectiveStoreCode) : (myStoreName ?? effectiveStoreCode)}`
              : "Export Excel workbooks for stock, movements, and packaging."}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap gap-4 items-end">
        {/* Admin: store picker */}
        {isAdmin && (
          <div className="space-y-1">
            <label htmlFor="report-store" className="text-[9px] font-extrabold text-slate-400 uppercase">Store</label>
            <div className="relative">
              <select id="report-store" value={selectedStoreCode ?? ""} onChange={(e) => setSelectedStoreCode(e.target.value || null)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-400">
                <option value="">All Stores</option>
                {stores.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Non-admin: show locked store */}
        {!isAdmin && myStoreName && (
          <div className="space-y-1">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Store</span>
            <span className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-800 text-xs font-bold px-3 py-1.5 rounded-lg">
              {myStoreName}
            </span>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="report-from" className="text-[9px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
            <Calendar className="h-3 w-3" /> From
          </label>
          <input id="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
        </div>
        <div className="space-y-1">
          <label htmlFor="report-to" className="text-[9px] font-extrabold text-slate-400 uppercase">To</label>
          <input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs" />
        </div>
        <p className="text-[10px] text-slate-400 font-medium pb-1">Date range applies to movement ledger and packaging runs.</p>
      </div>

      {error && (
        <div className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-4 py-2 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{r.label}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">{r.description}</p>
                </div>
              </div>
              <button type="button" onClick={() => handleDownload(r.id)} disabled={downloading === r.id}
                className="flex items-center gap-2 shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">
                {downloading === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Excel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
