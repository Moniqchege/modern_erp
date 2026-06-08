import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Scale,
  ShoppingCart,
  Truck,
  Wrench,
  LayoutDashboard,
  ClipboardList,
  ArrowLeft,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Activity,
  Menu,
  X,
} from "lucide-react";
import { ROUTES } from "../app/router/routes";
import { logout } from "../auth/authClient";

export type WeighbridgeNavKey =
  | "purchases"
  | "sales"
  | "others"
  | "dashboard"
  | "log";

interface NavItem {
  key: WeighbridgeNavKey;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  accent: "indigo" | "emerald" | "amber" | "rose" | "sky";
}

const ACCENT_STYLES: Record<NavItem["accent"], { active: string; icon: string; pill: string }> = {
  indigo: {
    active: "bg-indigo-50/80 border-indigo-100 text-indigo-800",
    icon: "bg-indigo-100 text-indigo-700",
    pill: "bg-indigo-600",
  },
  emerald: {
    active: "bg-emerald-50/80 border-emerald-100 text-emerald-800",
    icon: "bg-emerald-100 text-emerald-700",
    pill: "bg-emerald-600",
  },
  amber: {
    active: "bg-amber-50/80 border-amber-100 text-amber-800",
    icon: "bg-amber-100 text-amber-700",
    pill: "bg-amber-600",
  },
  rose: {
    active: "bg-rose-50/80 border-rose-100 text-rose-800",
    icon: "bg-rose-100 text-rose-700",
    pill: "bg-rose-600",
  },
  sky: {
    active: "bg-sky-50/80 border-sky-100 text-sky-800",
    icon: "bg-sky-100 text-sky-700",
    pill: "bg-sky-600",
  },
};

const weighbridgeNavItems: NavItem[] = [
  {
    key: "purchases",
    label: "Purchases",
    path: ROUTES.WEIGHBRIDGE_PURCHASES,
    icon: ShoppingCart,
    description: "Maize inflow · PO driven",
    accent: "emerald",
  },
  {
    key: "sales",
    label: "Sales",
    path: ROUTES.WEIGHBRIDGE_SALES,
    icon: Truck,
    description: "Flour outflow · SO driven",
    accent: "indigo",
  },
  {
    key: "others",
    label: "Others",
    path: ROUTES.WEIGHBRIDGE_OTHERS,
    icon: Wrench,
    description: "Third-party weighing services",
    accent: "amber",
  },
  {
    key: "dashboard",
    label: "Dashboard",
    path: ROUTES.WEIGHBRIDGE_DASHBOARD,
    icon: LayoutDashboard,
    description: "KPIs & traffic analytics",
    accent: "sky",
  },
  {
    key: "log",
    label: "Activities Log",
    path: ROUTES.WEIGHBRIDGE_LOG,
    icon: ClipboardList,
    description: "Searchable tickets · CSV/Excel",
    accent: "rose",
  },
];

function getActiveKey(pathname: string): WeighbridgeNavKey {
  if (pathname.startsWith(ROUTES.WEIGHBRIDGE_PURCHASES)) return "purchases";
  if (pathname.startsWith(ROUTES.WEIGHBRIDGE_SALES)) return "sales";
  if (pathname.startsWith(ROUTES.WEIGHBRIDGE_OTHERS)) return "others";
  if (pathname.startsWith(ROUTES.WEIGHBRIDGE_DASHBOARD)) return "dashboard";
  if (pathname.startsWith(ROUTES.WEIGHBRIDGE_LOG)) return "log";
  // Default landing — purchases is the main operational screen
  return "purchases";
}

export function WeighbridgeLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = getActiveKey(location.pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = () => setIsSidebarOpen(false);
  const handleNavigate = (path: string) => {
    navigate(path);
    closeSidebar();
  };
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex antialiased">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.04),transparent_45%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.03),transparent_40%)] pointer-events-none" />

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 bg-white border-r border-slate-200/80 flex flex-col shrink-0 shadow-sm
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="p-6 border-b border-slate-200/80">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => handleNavigate("/app")}
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-black text-slate-900 tracking-tight block">
                  Weighbridge
                </span>
                <span className="text-[10px] text-indigo-700 font-bold tracking-wider uppercase">
                  Plant Floor Operations
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={closeSidebar}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          <span className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
            Module Menu
          </span>
          {weighbridgeNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            const accent = ACCENT_STYLES[item.accent];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.path)}
                className={`relative w-full text-left flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all border ${
                  isActive
                    ? `${accent.active} shadow-sm`
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-transparent"
                }`}
              >
                {isActive && (
                  <div
                    className={`absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md ${accent.pill}`}
                  />
                )}
                <div
                  className={`p-1.5 rounded-lg ${
                    isActive ? accent.icon : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col relative">
                  <span className="text-xs font-bold tracking-wide">{item.label}</span>
                  <span className="text-[9px] text-slate-400 leading-none mt-0.5">
                    {item.description}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        <div
          className="p-4 border-t cursor-pointer border-slate-200/80 space-y-2"
          onClick={handleLogout}
        >
          <button
            type="button"
            onClick={() => handleNavigate("/app")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Modules
          </button>
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate">
                Weighbridge Operator
              </span>
              <span className="text-[9px] text-slate-500">Plant 1</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-slate-400 cursor-pointer hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg"
              title="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative w-48 sm:w-72 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tickets, trucks, drivers..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2.5 py-1 rounded-lg text-[10px] font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Scale online
            </div>
            <span className="text-xs font-bold text-slate-500 hidden sm:block">
              {currentDate}
            </span>
            <button
              type="button"
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 bg-white"
              aria-label="Notifications"
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-indigo-600 rounded-full" />
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 hover:bg-slate-50 px-2 py-1 rounded-lg"
              aria-label="Profile menu"
            >
              <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-extrabold text-indigo-700 border border-indigo-100">
                <Activity className="h-3 w-3" />
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
