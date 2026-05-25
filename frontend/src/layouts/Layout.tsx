import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";

export type NavKey = "dashboard" | "customers" | "invoices";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: NavKey;
  setActiveTab: (tab: NavKey) => void;
}

interface NavItem {
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Milling plant statistics",
  },
  {
    key: "customers",
    label: "Customers",
    icon: Users,
    description: "Client billing directory",
  },
  {
    key: "invoices",
    label: "Invoices",
    icon: FileText,
    description: "Sales billing statements",
  },
];

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = () => setIsSidebarOpen(false);

  const handleSetActiveTab = (tab: NavKey) => {
    setActiveTab(tab);
    closeSidebar();
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex antialiased selection:bg-indigo-650 selection:text-white relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.03),transparent_40%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.02),transparent_40%)] pointer-events-none" />

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
          w-72 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 shadow-sm
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 border-b border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <span className="text-white font-extrabold text-xl tracking-wider">M</span>
                </div>
                <div>
                  <span className="text-base font-black text-slate-900 tracking-tight">
                    Milling ERP
                  </span>
                  <span className="block text-[10px] text-indigo-600 font-bold tracking-wider uppercase">
                    Production Suite
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

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5 mt-4">
            <span className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
              Plant Modules
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSetActiveTab(item.key)}
                  className={`w-full text-left flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 group relative border ${
                    isActive
                      ? "bg-indigo-50/70 border-indigo-100 text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-transparent"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r-md bg-indigo-650" />
                  )}
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? "bg-indigo-100 text-indigo-650"
                        : "bg-slate-100 text-slate-400 group-hover:text-slate-650 group-hover:bg-indigo-50/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold tracking-wide">{item.label}</span>
                    <span className="text-[9px] text-slate-400 leading-none mt-0.5 group-hover:text-slate-500 transition-colors">
                      {item.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile Card */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50">
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100"
                  alt="Alex Mercer"
                  className="h-9 w-9 rounded-xl object-cover border border-slate-200"
                />
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-500/20" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-800 truncate">Alex Mercer</span>
                <span className="text-[9px] text-slate-500 flex items-center gap-1 font-medium">
                  <ShieldCheck className="h-3 w-3 text-indigo-650" /> Plant Manager
                </span>
              </div>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
              title="Log Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative w-48 sm:w-60 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-indigo-650 transition-colors" />
              <input
                type="text"
                placeholder="Search inventory, milling runs..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-all text-slate-800"
              />
            </div>
            <span className="text-[10px] text-slate-400 hidden md:block font-medium">
              Press{" "}
              <kbd className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] text-slate-500">
                Ctrl + K
              </kbd>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Plant online</span>
            </div>
            <span className="text-xs font-bold text-slate-500 hidden sm:block">{currentDate}</span>
            <button className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 bg-white shadow-sm">
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-indigo-600 rounded-full" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <button className="flex items-center gap-1.5 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
              <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-extrabold text-indigo-700 border border-indigo-100">
                HQ
              </div>
              <span className="text-xs font-bold text-slate-700 hidden md:inline">Milling Plant 1</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}