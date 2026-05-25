import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  Scale,
  GitCompare,
  ArrowLeft,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Landmark,
  Menu,
  X,
} from "lucide-react";
import { ROUTES } from "../app/router/routes";

export type ProcurementNavKey =
  | "dashboard"
  | "suppliers"
  | "requisitions"
  | "purchase-orders"
  | "receiving"
  | "finance";

interface NavItem {
  key: ProcurementNavKey;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const procurementNavItems: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: ROUTES.PROCUREMENT,
    icon: LayoutDashboard,
    description: "KPIs & workflow overview",
  },
  {
    key: "suppliers",
    label: "Suppliers & CRM",
    path: ROUTES.PROCUREMENT_SUPPLIERS,
    icon: Users,
    description: "Profiles, compliance, onboarding",
  },
  {
    key: "requisitions",
    label: "Requisitions",
    path: ROUTES.PROCUREMENT_REQUISITIONS,
    icon: ClipboardList,
    description: "Requests & approvals",
  },
  {
    key: "purchase-orders",
    label: "Purchase Orders",
    path: ROUTES.PROCUREMENT_POS,
    icon: FileText,
    description: "PO issue & delivery tracking",
  },
  {
    key: "receiving",
    label: "Receiving & QC",
    path: ROUTES.PROCUREMENT_RECEIVING,
    icon: Scale,
    description: "Weighbridge, lab QC, GRN",
  },
  {
    key: "finance",
    label: "3-Way Match & AP",
    path: ROUTES.PROCUREMENT_FINANCE,
    icon: GitCompare,
    description: "Invoice match & payments",
  },
];

function getActiveKey(pathname: string): ProcurementNavKey {
  if (pathname.startsWith(ROUTES.PROCUREMENT_SUPPLIERS)) return "suppliers";
  if (pathname.startsWith(ROUTES.PROCUREMENT_REQUISITIONS)) return "requisitions";
  if (pathname.startsWith(ROUTES.PROCUREMENT_POS)) return "purchase-orders";
  if (pathname.startsWith(ROUTES.PROCUREMENT_RECEIVING)) return "receiving";
  if (pathname.startsWith(ROUTES.PROCUREMENT_FINANCE)) return "finance";
  if (pathname === ROUTES.PROCUREMENT || pathname === `${ROUTES.PROCUREMENT}/`) {
    return "dashboard";
  }
  return "dashboard";
}

export function ProcurementLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = getActiveKey(location.pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = () => setIsSidebarOpen(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    closeSidebar();
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex antialiased">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.04),transparent_45%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.03),transparent_40%)] pointer-events-none" />

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
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
                <Landmark className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-black text-slate-900 tracking-tight block">
                  Procurement
                </span>
                <span className="text-[10px] text-emerald-700 font-bold tracking-wider uppercase">
                  Suppliers & Purchasing
                </span>
              </div>
            </div>
            {/* Close button — mobile only */}
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
          {procurementNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.path)}
                className={`relative w-full text-left flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all border ${
                  isActive
                    ? "bg-emerald-50/80 border-emerald-100 text-emerald-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-transparent"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-emerald-600" />
                )}
                <div
                  className={`p-1.5 rounded-lg ${
                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
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

        <div className="p-4 border-t border-slate-200/80 space-y-2">
          <button
            type="button"
            onClick={() => handleNavigate("/app")}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to all modules
          </button>
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate">Procurement Officer</span>
              <span className="text-[9px] text-slate-500">Plant 1</span>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg"
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
            {/* Hamburger — mobile only */}
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
                placeholder="Search suppliers, POs, GRNs..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-lg text-[10px] font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Procurement online
            </div>
            <span className="text-xs font-bold text-slate-500 hidden sm:block">{currentDate}</span>
            <button
              type="button"
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 bg-white"
            >
              <Bell className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="flex items-center gap-1.5 hover:bg-slate-50 px-2 py-1 rounded-lg">
              <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center text-[10px] font-extrabold text-emerald-700 border border-emerald-100">
                PR
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