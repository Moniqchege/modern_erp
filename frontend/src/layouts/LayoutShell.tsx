import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "./Layout";
import { ProcurementLayout } from "./ProcurementLayout";
import { InventoryLayout } from "./InventoryLayout";
import { SalesLayout } from "./SalesLayout";
import { BudgetLayout } from "./BudgetLayout";
import { FinanceLayout } from "./FinanceLayout";
import { WeighbridgeLayout } from "./WeighbridgeLayout";
import { ROUTES } from "../app/router/routes";

type SidebarKey = "dashboard" | "customers" | "invoices";

function isProcurementModule(pathname: string): boolean {
  return pathname === ROUTES.PROCUREMENT || pathname.startsWith(`${ROUTES.PROCUREMENT}/`);
}

function isInventoryModule(pathname: string): boolean {
  return pathname === ROUTES.INVENTORY || pathname.startsWith(`${ROUTES.INVENTORY}/`);
}

function isSalesModule(pathname: string): boolean {
  return pathname === ROUTES.SALES || pathname.startsWith(`${ROUTES.SALES}/`);
}

function isBudgetModule(pathname: string): boolean {
  return pathname === ROUTES.BUDGET || pathname.startsWith(`${ROUTES.BUDGET}/`);
}

function isFinanceModule(pathname: string): boolean {
  return pathname === ROUTES.FINANCE || pathname.startsWith(`${ROUTES.FINANCE}/`);
}

function isWeighbridgeModule(pathname: string): boolean {
  return (
    pathname === ROUTES.WEIGHBRIDGE ||
    pathname.startsWith(`${ROUTES.WEIGHBRIDGE}/`)
  );
}

function getSidebarKeyFromPath(pathname: string): SidebarKey {
  if (pathname === "/" || pathname.startsWith(ROUTES.DASHBOARD)) return "dashboard";
  if (pathname.startsWith(ROUTES.CUSTOMERS)) return "customers";
  if (pathname.startsWith(ROUTES.INVOICES)) return "invoices";
  return "dashboard";
}

export function LayoutShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getSidebarKeyFromPath(location.pathname);

  const handleSetActiveTab = (tab: SidebarKey) => {
    switch (tab) {
      case "dashboard":
        navigate(ROUTES.DASHBOARD);
        return;
      case "customers":
        navigate(ROUTES.CUSTOMERS);
        return;
      case "invoices":
        navigate(ROUTES.INVOICES);
        return;
    }
  };

  if (isProcurementModule(location.pathname)) {
    return <ProcurementLayout />;
  }

  if (isSalesModule(location.pathname)) {
    return <SalesLayout />;
  }

  if (isInventoryModule(location.pathname)) {
    return <InventoryLayout />;
  }

  if (isBudgetModule(location.pathname)) {
    return <BudgetLayout />;
  }

  if (isFinanceModule(location.pathname)) {
    return <FinanceLayout />;
  }

  if (isWeighbridgeModule(location.pathname)) {
    return <WeighbridgeLayout />;
  }

  const shouldHideSidebar = location.pathname === "/app";

  if (shouldHideSidebar) {
    return (
      <div className="h-screen bg-slate-50 text-slate-800 font-sans flex antialiased selection:bg-indigo-650 selection:text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.03),transparent_40%)] pointer-events-none z-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.02),transparent_40%)] pointer-events-none z-0" />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10 h-screen">
          <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative w-60 group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" />
                <input
                  type="text"
                  placeholder="Search modules..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-all text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Plant online</span>
              </div>
              <span className="text-xs font-bold text-slate-500 hidden sm:block">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </header>

          <main className="flex-1 min-h-0">
            <div className="max-w-7xl mx-auto min-h-full flex items-center justify-center pb-16 sm:pb-8">
              <div className="w-full flex flex-col items-center">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={handleSetActiveTab}>
      <Outlet />
    </Layout>
  );
}
