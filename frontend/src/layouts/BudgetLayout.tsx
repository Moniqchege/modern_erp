import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  Coins,
  Receipt,
  ArrowLeft,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { ROUTES } from "../app/router/routes";
import { logout } from "../auth/authClient";

export type BudgetNavKey =
  | "dashboard"
  | "allocations"
  | "imprests"
  | "surrenders";

interface NavItem {
  key: BudgetNavKey;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const budgetNavItems: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: ROUTES.BUDGET,
    icon: LayoutDashboard,
    description: "KPIs & budget overview",
  },
  {
    key: "allocations",
    label: "Budget Allocations",
    path: ROUTES.BUDGET_ALLOCATIONS,
    icon: Coins,
    description: "Periods & department limits",
  },
  {
    key: "imprests",
    label: "Imprest Requests",
    path: ROUTES.BUDGET_IMPRESTS,
    icon: Wallet,
    description: "Petty cash claims & approvals",
  },
  {
    key: "surrenders",
    label: "Imprest Surrenders",
    path: ROUTES.BUDGET_SURRENDERS,
    icon: Receipt,
    description: "Surrender receipts & refunds",
  },
];

function getActiveKey(pathname: string): BudgetNavKey {
  if (pathname.startsWith(ROUTES.BUDGET_ALLOCATIONS)) return "allocations";
  if (pathname.startsWith(ROUTES.BUDGET_IMPRESTS)) return "imprests";
  if (pathname.startsWith(ROUTES.BUDGET_SURRENDERS)) return "surrenders";
  return "dashboard";
}

export function BudgetLayout() {
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.03),transparent_40%)] pointer-events-none" />

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
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate("/app")}>
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-655 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-black text-slate-900 tracking-tight block">
                  Budget & Imprest
                </span>
                <span className="text-[10px] text-indigo-700 font-bold tracking-wider uppercase">
                  Uwezo Allocations
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
          {budgetNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.path)}
                className={`relative w-full text-left flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all border ${
                  isActive
                    ? "bg-indigo-50/80 border-indigo-100 text-indigo-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-transparent"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-indigo-600" />
                )}
                <div
                  className={`p-1.5 rounded-lg ${
                    isActive ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
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

        <div className="p-4 border-t cursor-pointer border-slate-200/80 space-y-2" onClick={handleLogout}>
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate">Budget Manager</span>
              <span className="text-[9px] text-slate-500">Corporate Office</span>
            </div>
            <button
              type="button"
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
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => navigate("/app")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-50 shadow-sm transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Modules</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2.5 py-1 rounded-lg text-[10px] font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Budget online
            </div>
            <span className="text-xs font-bold text-slate-500 hidden sm:block">{currentDate}</span>
            <button
              type="button"
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 bg-white"
            >
              <Bell className="h-3.5 w-3.5" />
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
