import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Percent,
  Wheat,
  Warehouse,
  TrendingUp,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface DashboardProps {
  onNavigate?: (tab: "dashboard" | "inventory" | "production" | "customers" | "invoices") => void;
}

type DashboardApiResponse = {
  success: boolean;
  stats: {
    rawMaizeStockKg: number;
    grade1FlourStockKg: number;
    grade2FlourStockKg: number;
    avgMillingEfficiencyPct: number;
    avgYieldLossRatePct: number;
  };
  yieldHistory: Array<{ label: string; efficiencyPct: number }>;
  recentActivities: Array<{
    runNumber: string;
    startTime: string | Date;
    yieldEfficiency: number;
    variancePercent: number;
  }>;
};

function formatKg(n: number) {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG`;
}
function formatPct(n: number) {
  return `${n.toFixed(2)}%`;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [data, setData] = useState<DashboardApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/summary");
        const json = (await res.json()) as DashboardApiResponse;
        if (mounted) setData(json);
      } catch {
        // keep UI usable even if API fails
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const s = data?.stats;
    if (!s) return [];

    // Change/delta is not currently provided by backend; derive a neutral placeholder.
    return [
      {
        label: "Raw Maize Stock",
        value: formatKg(s.rawMaizeStockKg),
        change: "+0.00 KG",
        isPositive: true,
        timeframe: "Available (approved batches)",
        icon: Wheat,
        border: "border-amber-100",
        iconColor: "text-amber-600 bg-amber-100",
      },
      {
        label: "Grade 1 Flour Stock",
        value: formatKg(s.grade1FlourStockKg),
        change: "+0.00 KG",
        isPositive: true,
        timeframe: "Finished goods on hand",
        icon: Warehouse,
        border: "border-emerald-100",
        iconColor: "text-emerald-600 bg-emerald-100",
      },
      {
        label: "Grade 2 Flour Stock",
        value: formatKg(s.grade2FlourStockKg),
        change: "-0.00 KG",
        isPositive: false,
        timeframe: "Finished goods on hand",
        icon: Warehouse,
        border: "border-sky-100",
        iconColor: "text-sky-600 bg-sky-100",
      },
      {
        label: "Avg Milling Efficiency",
        value: formatPct(s.avgMillingEfficiencyPct),
        change: "+0.00%",
        isPositive: true,
        timeframe: `Avg yield loss: ${formatPct(s.avgYieldLossRatePct)}`,
        icon: Percent,
        border: "border-indigo-100",
        iconColor: "text-indigo-600 bg-indigo-100",
      },
    ];
  }, [data]);

  const recentActivities = useMemo(() => {
    if (!data?.recentActivities) return [];
    return data.recentActivities.map((a, idx) => {
      const t = new Date(a.startTime);
      const minutesAgo = Math.floor((Date.now() - t.getTime()) / 60000);
      const timeLabel =
        minutesAgo < 60
          ? `${minutesAgo} mins ago`
          : `${Math.floor(minutesAgo / 60)} hours ago`;

      return {
        id: idx + 1,
        type: "production" as const,
        title: `Batch ${a.runNumber} processed`,
        description: `Yield efficiency: ${formatPct(a.yieldEfficiency)} (variance ${a.variancePercent?.toFixed(2)}%)`,
        time: timeLabel,
      };
    });
  }, [data]);

  const chartPoints = useMemo(() => {
    const history = data?.yieldHistory ?? [];
    const values = history.map((h) => h.efficiencyPct);
    if (values.length < 2) return { path: "M0,22 L100,5", labels: [] as string[] };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const normalized = (v - min) / range;
      const y = 35 - normalized * 30; // map to [5..35]
      return { x, y };
    });

    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" ");

    const labels = history.map((h) => h.label);
    return { path: d, labels };
  }, [data]);

  return (

    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-8 rounded-2xl relative overflow-hidden shadow-sm">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.04),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 space-y-1.5">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Milling Operations Dashboard
          </h1>
          <p className="text-xs text-slate-500 max-w-xl font-medium">
            Monitor raw maize intakes, trace milling runs, evaluate transformation yields, and maintain flour stock health.
          </p>
        </div>
       <div className="flex items-center gap-3 relative z-10 shrink-0">
  <button 
    onClick={() => navigate(`/inventory/production`)}
    className="flex items-center gap-1 !bg-[#ffa255] hover:!bg-[#f2c096] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
  >
    <Plus className="h-4 w-4" />
    Start Milling Run
  </button>

  <button 
    onClick={() => navigate(`/inventory/catalogue`)} 
    className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs px-6 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm"
  >
    Manage Inventory
  </button>
</div>
      </div>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className={`bg-white border ${stat.border} rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md shadow-sm group relative overflow-hidden`}
            >
              {/* Highlight background strip */}
              <div className={`absolute top-0 inset-x-0 h-1 ${stat.iconColor.split(" ")[1]}`} />
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold tracking-wider text-slate-450 uppercase">
                  {stat.label}
                </span>
                <div className={`p-1 rounded-xl transition-colors ${stat.iconColor}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {stat.value}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-450 font-bold truncate pr-2">
                  {stat.timeframe}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 ${
                    stat.isPositive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-750"
                  }`}
                >
                  {stat.isPositive ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  {stat.change}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Charts & Activity Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Milling Efficiency History */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-650" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Transformation Yield History</h3>
              </div>
              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">
                Analytics
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Yield percentage (milled outputs weight vs. grain raw input weight) for the last 6 milling runs.</p>
          </div>

          {/* Clean Light-Theme SVG Chart */}
          <div className="h-40 my-6 flex items-end relative">
            <svg className="w-full h-full" viewBox="0 0 100 35" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGlowLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f78220" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#fabe8c" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="indigoPurpleGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f78220" />
                  <stop offset="100%" stopColor="#fabe8c" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="5" x2="100" y2="5" stroke="#f1f5f9" strokeWidth="0.5" />
              <line x1="0" y1="15" x2="100" y2="15" stroke="#f1f5f9" strokeWidth="0.5" />
              <line x1="0" y1="25" x2="100" y2="25" stroke="#f1f5f9" strokeWidth="0.5" />

              {/* Glowing Area Fill (use computed path when available) */}
              <path
                d={
                  chartPoints.labels.length
                    ? `M0,35 ${chartPoints.path.replace(/^M/, "L")}`
                    : "M0,35 L0,22 Q15,15 30,23 T60,10 T85,12 L100,5 L100,35 Z"
                }
                fill="url(#chartGlowLight)"
              />
              {/* Glowing Trendline */}
              <path
                d={chartPoints.path}
                fill="none"
                stroke="url(#indigoPurpleGrad)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex justify-between text-[9px] text-slate-400 font-bold px-1 select-none">
              {(chartPoints.labels.length ? chartPoints.labels : ["Run #1","Run #2","Run #3","Run #4","Run #5","Run #6"]).slice(0,6).map((lbl, i) => (
                <span key={i}>{lbl}</span>
              ))}
            </div>
          </div>


          <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>
              Average yield loss rate: <strong className="text-slate-800">{data ? formatPct(data.stats.avgYieldLossRatePct) : "0.00%"}</strong>
            </span>
          </div>

        </div>

        {/* Recent Activities Feed */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-655" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Operational Logs</h3>
            </div>
            <p className="text-xs text-slate-550 font-medium">System audit trails of physical item transfers.</p>
          </div>

          <div className="space-y-4 my-2 grow">
            {recentActivities.map((act) => (
              <div key={act.id} className="flex gap-3 text-xs leading-relaxed group">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full ring-4 ring-white mt-1.5 shrink-0 ${
                    act.type === "production" ? "bg-indigo-600" : "bg-amber-500"
                  }`} />
                  <div className="w-0.5 grow bg-slate-100 group-last:bg-transparent mt-1" />
                </div>
                <div className="space-y-0.5 pb-2 grow min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 truncate">{act.title}</span>
                    <span className="text-[9px] text-slate-400 font-semibold shrink-0">{act.time}</span>
                  </div>
                  <p className="text-slate-500 text-[10px] leading-normal font-medium">{act.description}</p>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => navigate(`/inventory/production`)}
            className="w-full text-center py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-xs font-bold text-slate-655 hover:text-slate-800 transition-colors"
          >
            Show milling batch log
          </button>
        </div>
      </div>
    </div>
  );
}
