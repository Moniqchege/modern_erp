import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LayoutShell } from "../../layouts/LayoutShell";
import { ROUTES } from "./routes";
import { NotFound } from "../../pages/NotFound";
import { isAuthenticated } from "../../auth/authClient";

const Dashboard = lazy(() => import("../../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Inventory = lazy(() => import("../../pages/inventory/Inventory").then((m) => ({ default: m.Inventory })));
const InventoryItemView = lazy(() => import("../../pages/inventory/InventoryItemView").then((m) => ({ default: m.InventoryItemView })));
const ProductionForm = lazy(() => import("../../pages/ProductionForm").then((m) => ({ default: m.ProductionForm })));
const Customers = lazy(() => import("../../pages/Customers").then((m) => ({ default: m.Customers })));
const Invoices = lazy(() => import("../../pages/Invoices").then((m) => ({ default: m.Invoices })));

const Login = lazy(() => import("../../pages/Login").then((m) => ({ default: m.Login })));
const VerifyOtp = lazy(() => import("../../pages/VerifyOtp").then((m) => ({ default: m.VerifyOtp })));
const ForceResetPassword = lazy(() => import("../../pages/ForceResetPassword").then((m) => ({ default: m.ForceResetPassword })));
const ModuleLanding = lazy(() => import("../../pages/ModuleLanding").then((m) => ({ default: m.ModuleLanding })));

export function AppRouter() {
  const RequireAuth = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated()) return <Navigate to="/login" replace />;
    return <>{children}</>;
  };


  return (
    <Suspense fallback={<div className="p-8 text-xs font-bold text-slate-500">Loading…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/force-reset" element={<ForceResetPassword />} />

        <Route
          element={
            <RequireAuth>
              <LayoutShell />
            </RequireAuth>
          }
        >
          <Route path={ROUTES.ROOT} element={<Navigate to="/app" replace />} />
          <Route path="/app" element={<ModuleLanding />} />

          <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
          <Route path={ROUTES.INVENTORY} element={<Inventory />} />
          <Route path={ROUTES.INVENTORY_NEW} element={<Inventory />} />
          <Route path="/inventory/:itemId" element={<InventoryItemView />} />
          <Route path="/inventory/:itemId/edit" element={<InventoryItemView />} />
          <Route path={ROUTES.PRODUCTION} element={<ProductionForm />} />
          <Route path={ROUTES.CUSTOMERS} element={<Customers />} />
          <Route path={ROUTES.INVOICES} element={<Invoices />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}





