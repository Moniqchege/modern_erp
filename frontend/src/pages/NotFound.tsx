import React from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../app/router/routes";

export function NotFound() {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">404</h1>
        <p className="text-xs text-slate-500 mt-2 font-medium">
          The page you are looking for does not exist.
        </p>
        <div className="mt-6">
          <Link
            to={ROUTES.DASHBOARD}
            className="inline-flex items-center gap-2 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all active:scale-95"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

