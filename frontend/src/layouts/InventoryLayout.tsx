import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Factory,
  Box,
  FileSpreadsheet,
  Bell,
  ChevronDown,
  LogOut,
  Boxes,
  Menu,
  X,
  ArrowLeftRight,
  Store,
  Search,
  Truck,
} from "lucide-react";
import { ROUTES } from "../app/router/routes";
import { getCurrentUser, logout } from "../auth/authClient";
import { apiFetch } from "../api/apiClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InventoryNavKey =
  | "dashboard"
  | "catalogue"
  | "production"
  | "packaging"
  | "stockTransfers"
  | "baleTransfers"
  | "stores"
  | "reports";

interface NavItem {
  key: InventoryNavKey;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  adminOnly?: boolean;
  baleOnly?: boolean;
}

// ─── Nav definition ───────────────────────────────────────────────────────────

const ALL_NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: ROUTES.INVENTORY,
    icon: LayoutDashboard,
    description: "KPIs, stock & operations",
  },
  {
    key: "catalogue",
    label: "Stock Catalogue",
    path: ROUTES.INVENTORY_CATALOGUE,
    icon: Package,
    description: "SKUs, levels & pricing",
  },
  {
    key: "production",
    label: "Production / Milling",
    path: ROUTES.INVENTORY_PRODUCTION,
    icon: Factory,
    description: "Raw maize to bulk flour",
    adminOnly: true,
  },
  {
    key: "packaging",
    label: "Packaging",
    path: ROUTES.INVENTORY_PACKAGING,
    icon: Box,
    description: "24 kg bales & materials",
    adminOnly: true,
  },
  {
    key: "stockTransfers",
    label: "Stock Transfers",
    path: ROUTES.INVENTORY_STOCK_TRANSFERS,
    icon: ArrowLeftRight,
    description: "Request, issue & receive",
  },
  {
    key: "baleTransfers",
    label: "Bale Transfers",
    path: ROUTES.INVENTORY_BALE_TRANSFERS,
    icon: Truck,
    description: "Packaging → Dispatch",
    baleOnly: true,
  },
  {
    key: "stores",
    label: "Stores",
    path: ROUTES.INVENTORY_STORES,
    icon: Store,
    description: "Register & manage stores",
    adminOnly: true,
  },
  {
    key: "reports",
    label: "Reports",
    path: ROUTES.INVENTORY_REPORTS,
    icon: FileSpreadsheet,
    description: "Excel exports",
  },
];

function getActiveKey(pathname: string): InventoryNavKey {
  if (pathname.startsWith(ROUTES.INVENTORY_CATALOGUE)) return "catalogue";
  if (pathname.startsWith(ROUTES.INVENTORY_PRODUCTION)) return "production";
  if (pathname.startsWith(ROUTES.INVENTORY_PACKAGING)) return "packaging";
  if (pathname.startsWith(ROUTES.INVENTORY_BALE_TRANSFERS)) return "baleTransfers";
  if (pathname.startsWith(ROUTES.INVENTORY_STOCK_TRANSFERS)) return "stockTransfers";
  if (pathname.startsWith(ROUTES.INVENTORY_STORES)) return "stores";
  if (pathname.startsWith(ROUTES.INVENTORY_REPORTS)) return "reports";
  if (pathname === ROUTES.INVENTORY || pathname === `${ROUTES.INVENTORY}/`) return "dashboard";
  return "dashboard";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InventoryLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = getActiveKey(location.pathname);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Current user + their store assignment
  const user = getCurrentUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";
  const [storeName, setStoreName] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      apiFetch("/api/stores/me")
        .then((r) => r.json())
        .then((j: { store?: { name: string } | null }) => {
          setStoreName(j.store?.name ?? null);
        })
        .catch(() => null);
    }
  }, [isAdmin]);

  const isBaleParticipant =
    isAdmin ||
    user?.role === "PACKAGING_STORE_MANAGER" ||
    user?.role === "DISPATCH_STORE_MANAGER";

  const navItems = ALL_NAV_ITEMS.filter(
    (item) =>
      (!item.adminOnly || isAdmin) &&
      (!item.baleOnly || isBaleParticipant)
  );

  const closeSidebar = () => setIsSidebarOpen(false);
  const handleNavigate = (path: string) => { navigate(path); closeSidebar(); };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userInitials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "??";

  const roleLabelMap: Record<string, string> = {
    ADMIN: "Admin",
    SUPERADMIN: "Super Admin",
    MAIN_STORE_MANAGER: "Main Store",
    MAIZE_STORE_MANAGER: "Maize Store",
    PACKAGING_STORE_MANAGER: "Packaging Store",
    DISPATCH_STORE_MANAGER: "Dispatch Store",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
    WAREHOUSE_OPERATOR: "Warehouse Operator",
  };

  const roleLabel = user?.role ? (roleLabelMap[user.role] ?? user.role) : "—";
  const storeLabel = storeName ?? (isAdmin ? "All Stores" : roleLabel);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex antialiased">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,125,18,0.05),transparent_45%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.04),transparent_40%)] pointer-events-none" />

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
        {/* Logo */}
        <div className="p-6 border-b border-slate-200/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-md shadow-orange-500/25">
                <Boxes
                  className="h-5 w-5 text-white cursor-pointer"
                  onClick={() => handleNavigate("/app")}
                />
              </div>
              <div>
                <span
                  className="text-base font-black text-slate-900 tracking-tight block cursor-pointer"
                  onClick={() => handleNavigate("/app")}
                >
                  Inventory
                </span>
                <span className="text-[10px] text-orange-700 font-bold tracking-wider uppercase">
                  {isAdmin ? "All Stores" : storeLabel}
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

        {/* Store context badge for non-admins */}
        {!isAdmin && storeName && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100">
            <p className="text-[9px] font-extrabold text-orange-500 uppercase tracking-wider">Your store</p>
            <p className="text-xs font-bold text-orange-800 mt-0.5 truncate">{storeName}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          <span className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
            {isAdmin ? "Admin Menu" : "My Menu"}
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavigate(item.path)}
                className={`relative w-full text-left flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all border ${
                  isActive
                    ? "bg-orange-50/90 border-orange-100 text-orange-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-transparent"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-orange-500" />
                )}
                <div className={`p-1.5 rounded-lg ${isActive ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold tracking-wide">{item.label}</span>
                  <span className="text-[9px] text-slate-400 leading-none mt-0.5">{item.description}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* User widget */}
        <div className="p-4 border-t cursor-pointer border-slate-200/80" onClick={handleLogout}>
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-[10px] font-extrabold text-orange-700 shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.email ?? "—"}</p>
                <p className="text-[9px] text-slate-500 truncate">{roleLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-slate-400 cursor-pointer hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg shrink-0"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
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

            <div className="relative w-48 sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKUs, batches, movements..."
                aria-label="Search inventory"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500/10"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Store context pill */}
            <div className="hidden sm:flex items-center gap-1.5 bg-orange-50 text-orange-800 border border-orange-200/60 px-2.5 py-1 rounded-lg text-[10px] font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              {isAdmin ? "Admin view" : (storeName ?? roleLabel)}
            </div>

            <span className="text-xs font-bold text-slate-500 hidden sm:block">{currentDate}</span>

            <button
              type="button"
              aria-label="Notifications"
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 bg-white"
            >
              <Bell className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              aria-label="User menu"
              className="flex items-center cursor-pointer gap-1.5 hover:bg-slate-50 px-2 py-1 rounded-lg"
            >
              <div className="h-6 w-6 rounded-lg bg-orange-50 flex items-center justify-center text-[10px] font-extrabold text-orange-700 border border-orange-100">
                {userInitials}
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
