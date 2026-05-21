import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Boxes,
  Landmark,
  Users,
  Briefcase,
  Wallet,
  ShieldCheck,
  UserCog,
} from "lucide-react";

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
      title: "Admin",
      subtitle: "Users & roles",
      icon: ShieldCheck,
      to: "/dashboard",
    },
    {
      title: "Inventory",
      subtitle: "Catalog & movements",
      icon: Boxes,
      to: "/inventory",
    },
    {
      title: "Supplier mgt + Procurement",
      subtitle: "Vendors & purchasing",
      icon: Landmark,
      to: "/inventory",
    },
    {
      title: "Customer mgt + Sales",
      subtitle: "Customers & invoices",
      icon: Users,
      to: "/customers",
    },
    {
      title: "Budget mgt + Imprest mgt",
      subtitle: "Approvals & advances",
      icon: Wallet,
      to: "/invoices",
    },
    {
      title: "HR",
      subtitle: "Staff & policies",
      icon: UserCog,
      to: "/dashboard",
    },
    {
      title: "Finance Module",
      subtitle: "Accounting & reporting",
      icon: Briefcase,
      to: "/dashboard",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Modules</h1>
        <p className="text-xs text-slate-500 font-medium">Select a module to continue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.title}
              onClick={() => navigate(c.to)}
              className="text-left bg-white border border-slate-200 rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-black text-slate-900">{c.title}</div>
                  <div className="text-[11px] text-slate-500 font-medium">{c.subtitle}</div>
                </div>
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                  <Icon className="h-4 w-4 text-indigo-650" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-slate-500">
        Note: some destinations map to existing demo pages until the remaining modules are implemented.
      </div>
    </div>
  );
}

