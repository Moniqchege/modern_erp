import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Package,
  FileText,
  Truck,
  Wallet,
  ArrowLeft,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { ROUTES } from "../app/router/routes";
import { logout } from "../auth/authClient";

export type SalesNavKey =
  | "dashboard"
  | "customers"
  | "orders"
  | "products"
  | "dispatches"
  | "invoices"
  | "payments";

interface NavItem {
  key: SalesNavKey;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const salesNavItems: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: ROUTES.SALES,
    icon: LayoutDashboard,
    description: "Orders, credit & dispatch KPIs",
  },
  {
    key: "customers",
    label: "Customers",
    path: ROUTES.SALES_CUSTOMERS,
    icon: Users,
    description: "CRM, credit limits & tax PIN",
  },
  {
    key: "orders",
    label: "Sales Orders",
    path: ROUTES.SALES_ORDERS,
    icon: ShoppingCart,
    description: "Confirm, fulfill & invoice",
  },
  {
    key: "products",
    label: "Product Catalog",
    path: ROUTES.SALES_PRODUCTS,
    icon: Package,
    description: "SKUs, pricing & units",
  },
  {
    key: "dispatches",
    label: "Dispatch & Delivery",
    path: ROUTES.SALES_DISPATCHES,
    icon: Truck,
    description: "Truck loads & delivery status",
  },
  {
    key: "invoices",
    label: "Invoices",
    path: ROUTES.SALES_INVOICES,
    icon: FileText,
    description: "VAT billing from orders",
  },
  {
    key: "payments",
    label: "Payments",
    path: ROUTES.SALES_PAYMENTS,
    icon: Wallet,
    description: "M-Pesa, bank & cash receipts",
  },
];

function getActiveKey(pathname: string): SalesNavKey {
  if (pathname.startsWith(ROUTES.SALES_CUSTOMERS)) return "customers";
  if (pathname.startsWith(ROUTES.SALES_ORDERS)) return "orders";
  if (pathname.startsWith(ROUTES.SALES_PRODUCTS)) return "products";
  if (pathname.startsWith(ROUTES.SALES_DISPATCHES)) return "dispatches";
  if (pathname.startsWith(ROUTES.SALES_INVOICES)) return "invoices";
  if (pathname.startsWith(ROUTES.SALES_PAYMENTS)) return "payments";
  if (pathname === ROUTES.SALES || pathname === `${ROUTES.SALES}/`) return "dashboard";
  return "dashboard";
}

export function SalesLayout() {
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
    <div className="h-screen bg-slate-50 text-slate-800 font-sans flex antialiased overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.05),transparent_45%)] pointer-events-none z-0" />

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200/80 flex flex-col shrink-0 shadow-sm h-screen overflow-hidden transform transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => handleNavigate("/app")}
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-md">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-black text-slate-900 block">Sales</span>
                <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                  Customers & Delivery
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={closeSidebar}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto min-h-0">
          <span className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
            Module Menu
          </span>
          {salesNavItems.map((item) => {
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
                    : "text-slate-500 hover:bg-slate-50 border-transparent"
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
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{item.label}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">{item.description}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg border border-slate-200"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="relative w-56 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search sales..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
            <Bell className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:block">{currentDate}</span>
          </div>
        </header>
        <main className="flex-1 p-6 min-h-0">
          <div className="max-w-7xl mx-auto pb-16 sm:pb-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
