import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  Landmark,
  Users,
  Briefcase,
  Wallet,
  UserCog,
  ShieldCheck,
  Scale,
} from "lucide-react";
import { ROUTES } from "../app/router/routes";

type Card = {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
};

export function ModuleLanding() {
  const navigate = useNavigate();

  const cards: Card[] = [
    {
      title: "Admin Module",
      subtitle: "Users, roles & system settings",
      icon: ShieldCheck,
      to: "/dashboard",
    },
    {
      title: "Inventory Management",
      subtitle: "Stock Catalogue & Production Management",
      icon: Boxes,
      to: "/inventory",
    },
    {
      title: "Procurement & Suppliers",
      subtitle: "Vendors & purchasing workflow",
      icon: Landmark,
      to: "/procurement",
    },
    {
      title: "Customer & Sales",
      subtitle: "Orders, dispatch, invoices & payments",
      icon: Users,
      to: "/sales",
    },
    {
      title: "Budget & Imprest",
      subtitle: "Funds, approvals & allocations",
      icon: Wallet,
      to: ROUTES.BUDGET,
    },
    {
      title: "HR Module",
      subtitle: "Staff, payroll & policies",
      icon: UserCog,
      to: "/dashboard",
    },
    {
      title: "Finance Module",
      subtitle: "Accounting & financial reports",
      icon: Briefcase,
      to: ROUTES.FINANCE,
    },
    {
      title: "Weighbridge",
      subtitle: "Inbound maize, outbound flour & 3rd-party services",
      icon: Scale,
      to: ROUTES.WEIGHBRIDGE,
    },
  ];

  const [currentDate, setCurrentDate] = React.useState(
  new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
);

React.useEffect(() => {
  const timer = setInterval(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
  }, 60000); 

  return () => clearInterval(timer);
}, []);

  return (
    <div className="w-full min-h-screen mt-8 bg-slate-50 text-slate-900 flex flex-col">
      {/* HERO HEADER (ERP STYLE) */}
      <div className="relative overflow-hidden bg-gradient-to-br rounded-xl from-slate-900 to-slate-800 text-white px-10 py-10">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="h-full w-full bg-[radial-gradient(circle_at_2px_2px,white_1px,transparent_0)] bg-[length:24px_24px]" />
        </div>

        <div className="relative z-10">
          <div className="text-xs text-slate-300 mb-2">
            Home • Main Dashboard
          </div>

          <h1 className="text-3xl font-black tracking-tight">
            Enterprise Resource Planning System
          </h1>

          <p className="text-sm text-slate-300 mt-2 max-w-2xl">
            Streamlining operational excellence across inventory, procurement,
            finance, HR, and sales operations.
          </p>

          {/* status strip */}
          <div className="mt-6 flex items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/20 px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Plant Online
            </div>
            <span>{currentDate}</span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto w-full px-1 py-5 flex-1">
        {/* MODULE HEADER */}
        <div className="flex items-start justify-between mb-4">
  <div className="flex flex-col">
    <h2 className="text-lg font-bold flex items-center gap-3">
      Core Modules
      <span className="h-px w-20 bg-slate-300" />
    </h2>

    <span className="text-xs text-slate-500 mt-1">
      Select a module to continue
    </span>
  </div>
</div>

        {/* GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cards.map((c) => {
            const Icon = c.icon;

            return (
              <button
                key={c.title}
                onClick={() => navigate(c.to)}
                className="group relative text-left bg-white border border-slate-200 rounded-xl p-6 h-[160px] flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:bg-slate-50"
              >
                {/* icon row */}
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-slate-700 group-hover:text-slate-900" />
                  </div>
                </div>

                {/* text */}
                <div>
                  <div className="text-sm font-bold text-slate-900 group-hover:text-slate-950">
                    {c.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {c.subtitle}
                  </div>
                </div>

                {/* dimension hint (like your reference UI) */}
                <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-60 transition">
                  280 × 160
                </div>
              </button>
            );
          })}

          {/* ADD MODULE CARD */}
          <button className="border-2 border-dashed border-slate-300 rounded-xl p-6 h-[160px] flex flex-col items-center justify-center text-slate-500 hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition">
            <div className="text-2xl mb-2">＋</div>
            <div className="text-xs font-medium">Custom Module</div>
          </button>
        </div>

        {/* FOOTER */}
        <div className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500 flex flex-col md:flex-row justify-between gap-2">
  <div>
    © {new Date().getFullYear()} Uwezo ERP. All Rights Reserved.
    <span className="inline-flex items-center gap-2 ml-2">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      Built for operational excellence
    </span>
  </div>
</div>
      </div>
    </div>
  );
}