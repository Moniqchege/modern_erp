import React, { useState, createContext, useContext } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, Search, Bell, ChevronDown } from "lucide-react";

interface MainLayoutProps {
  children?: React.ReactNode;
}

const SidebarContext = createContext({
  isSidebarOpen: false,
  toggleSidebar: () => {},
  closeSidebar: () => {},
  setIsSidebarOpen: (_open: boolean) => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const isModuleLanding = location.pathname === "/app";

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, closeSidebar, setIsSidebarOpen }}>
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex antialiased selection:bg-indigo-650 selection:text-white relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.03),transparent_40%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.02),transparent_40%)] pointer-events-none" />

        {/* Mobile sidebar overlay — clicking it closes the sidebar */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
            onClick={closeSidebar}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
          {/* Top Header */}
          <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-4">
              {/* Hamburger — hidden on module landing, hidden on lg+ */}
              {!isModuleLanding && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
                  aria-label="Toggle sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}

              <div className="relative w-48 sm:w-60 group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-indigo-650 transition-colors" />
                <input
                  aria-label="Search modules"
                  type="text"
                  placeholder={isModuleLanding ? "Search modules..." : "Search..."}
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
              <button
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 bg-white shadow-sm"
                aria-label="Notifications"
              >
                <Bell className="h-3.5 w-3.5" />
                <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-indigo-600 rounded-full" />
              </button>
              <div className="h-6 w-px bg-slate-200" />
              <button
                className="flex items-center gap-1.5 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors"
                aria-label="Select organization"
              >
                <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-extrabold text-indigo-700 border border-indigo-100">
                  HQ
                </div>
                <span className="text-xs font-bold text-slate-700 hidden md:inline">Milling Plant 1</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex min-w-0">{children || <Outlet />}</div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}