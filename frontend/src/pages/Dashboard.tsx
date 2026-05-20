import {
  TrendingUp,
  Activity,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Wheat,
  Scale,
  Percent,
  Warehouse,
} from "lucide-react";
import React from "react";

interface DashboardProps {
  onNavigate?: (tab: "dashboard" | "inventory" | "production" | "customers" | "invoices") => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  // Milling Plant specific stats
  const stats = [
    {
      label: "Raw Maize Stock",
      value: "4,250.50 KG",
      change: "+2,000.00 KG",
      isPositive: true,
      timeframe: "Last intake yesterday",
      icon: Wheat,
      bg: "bg-amber-50/60",
      border: "border-amber-100",
      iconColor: "text-amber-600 bg-amber-100",
    },
    {
      label: "Grade 1 Flour Stock",
      value: "1,420.00 KG",
      change: "+385.00 KG",
      isPositive: true,
      timeframe: "From today's milling",
      icon: Warehouse,
      bg: "bg-emerald-50/60",
      border: "border-emerald-100",
      iconColor: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Grade 2 Flour Stock",
      value: "840.50 KG",
      change: "-120.00 KG",
      isPositive: false,
      timeframe: "Pending invoice dispatch",
      icon: Warehouse,
      bg: "bg-sky-50/60",
      border: "border-sky-100",
      iconColor: "text-sky-600 bg-sky-100",
    },
    {
      label: "Avg Milling Efficiency",
      value: "96.42%",
      change: "+0.85%",
      isPositive: true,
      timeframe: "Target threshold: 95.00%",
      icon: Percent,
      bg: "bg-indigo-50/60",
      border: "border-indigo-100",
      iconColor: "text-indigo-600 bg-indigo-100",
    },
  ];

  const recentActivities = [
    {
      id: 1,
      type: "production",
      title: "Batch M-BATCH-5291 processed",
      description: "Milled 500 KG Maize. Yielded 482 KG total products (96.40% efficiency)",
      time: "15 mins ago",
    },
    {
      id: 2,
      type: "inventory",
      title: "Raw material replenishment received",
      description: "Intake of 2,000 KG Raw Maize grain added to SKU MZ-RAW-01",
      time: "2 hours ago",
    },
    {
      id: 3,
      type: "production",
      title: "Batch M-BATCH-5290 processed",
      description: "Milled 350 KG Maize. Yielded 341 KG total products (97.43% efficiency)",
      time: "4 hours ago",
    },
    {
      id: 4,
      type: "inventory",
      title: "Product dispatch completed",
      description: "150 KG Grade 1 Flour sold to Bakeries Association",
      time: "6 hours ago",
    },
  ];

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
    onClick={() => onNavigate?.("production")} 
    className="flex items-center gap-1 !bg-[#ffa255] hover:!bg-[#f2c096] text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
  >
    <Plus className="h-4 w-4" />
    Start Milling Run
  </button>

  <button 
    onClick={() => onNavigate?.("inventory")} 
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
                <div className={`p-2 rounded-xl transition-colors ${stat.iconColor}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
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

              {/* Glowing Area Fill */}
              <path
                d="M0,35 L0,22 Q15,15 30,23 T60,10 T85,12 L100,5 L100,35 Z"
                fill="url(#chartGlowLight)"
              />
              {/* Glowing Trendline */}
              <path
                d="M0,22 Q15,15 30,23 T60,10 T85,12 L100,5"
                fill="none"
                stroke="url(#indigoPurpleGrad)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex justify-between text-[9px] text-slate-400 font-bold px-1 select-none">
              <span>Run #1</span>
              <span>Run #2</span>
              <span>Run #3</span>
              <span>Run #4</span>
              <span>Run #5</span>
              <span>Run #6</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Average yield loss rate: <strong className="text-slate-800">3.58%</strong></span>
            <span 
              onClick={() => onNavigate?.("production")}
              className="text-indigo-650 font-bold hover:text-indigo-700 cursor-pointer hover:underline flex items-center gap-0.5"
            >
              Analyze production batches &rarr;
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
            onClick={() => onNavigate?.("production")}
            className="w-full text-center py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-xs font-bold text-slate-655 hover:text-slate-800 transition-colors"
          >
            Show milling batch log
          </button>
        </div>
      </div>
    </div>
  );
}
