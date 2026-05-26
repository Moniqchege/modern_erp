import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LayoutShell } from "../../layouts/LayoutShell";
import { InventoryLayout } from "../../layouts/InventoryLayout";
import { ROUTES } from "./routes";
import {
  LegacyInventoryItemEditRedirect,
  LegacyInventoryItemRedirect,
} from "./LegacyInventoryRedirect";
import { NotFound } from "../../pages/NotFound";
import { isAuthenticated } from "../../auth/authClient";

const Dashboard = lazy(() => import("../../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const InventoryDashboard = lazy(() =>
  import("../../pages/inventory/InventoryDashboard").then((m) => ({ default: m.InventoryDashboard }))
);
const Inventory = lazy(() => import("../../pages/inventory/Inventory").then((m) => ({ default: m.Inventory })));
const InventoryItemView = lazy(() =>
  import("../../pages/inventory/InventoryItemView").then((m) => ({ default: m.InventoryItemView }))
);
const ProductionForm = lazy(() =>
  import("../../pages/inventory/ProductionForm").then((m) => ({ default: m.ProductionForm }))
);
const PackagingForm = lazy(() =>
  import("../../pages/inventory/PackagingForm").then((m) => ({ default: m.PackagingForm }))
);
const InventoryReports = lazy(() =>
  import("../../pages/inventory/InventoryReports").then((m) => ({ default: m.InventoryReports }))
);
const StockTransfers = lazy(() =>
  import("../../pages/inventory/StockTransfers").then((m) => ({ default: m.StockTransfers }))
);
const StockTransferForm = lazy(() =>
  import("../../pages/inventory/StockTransferForm").then((m) => ({ default: m.StockTransferForm }))
);
const Customers = lazy(() => import("../../pages/Customers").then((m) => ({ default: m.Customers })));
const Invoices = lazy(() => import("../../pages/Invoices").then((m) => ({ default: m.Invoices })));
const ProcurementDashboard = lazy(() =>
  import("../../pages/procurement/ProcurementDashboard").then((m) => ({ default: m.ProcurementDashboard }))
);
const ProcurementSuppliers = lazy(() =>
  import("../../pages/procurement/Suppliers").then((m) => ({ default: m.Suppliers }))
);
const ProcurementSupplierDetail = lazy(() =>
  import("../../pages/procurement/SupplierDetail").then((m) => ({ default: m.SupplierDetail }))
);
const ProcurementRequisitions = lazy(() =>
  import("../../pages/procurement/Requisitions").then((m) => ({ default: m.Requisitions }))
);
const ProcurementPOs = lazy(() =>
  import("../../pages/procurement/PurchaseOrders").then((m) => ({ default: m.PurchaseOrders }))
);
const ProcurementReceiving = lazy(() =>
  import("../../pages/procurement/ReceivingQC").then((m) => ({ default: m.ReceivingQC }))
);
const ProcurementFinance = lazy(() =>
  import("../../pages/procurement/ThreeWayMatch").then((m) => ({ default: m.ThreeWayMatch }))
);

const Login = lazy(() => import("../../pages/Login").then((m) => ({ default: m.Login })));
const VerifyOtp = lazy(() => import("../../pages/VerifyOtp").then((m) => ({ default: m.VerifyOtp })));
const ForceResetPassword = lazy(() =>
  import("../../pages/ForceResetPassword").then((m) => ({ default: m.ForceResetPassword }))
);
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

          <Route path="/inventory">
            <Route index element={<InventoryDashboard />} />
            <Route path="catalogue" element={<Inventory />} />
            <Route path="catalogue/new" element={<Inventory />} />
            <Route path="catalogue/:itemId" element={<InventoryItemView />} />
            <Route path="catalogue/:itemId/edit" element={<InventoryItemView />} />
            <Route path="production" element={<ProductionForm />} />
            <Route path="packaging" element={<PackagingForm />} />
            <Route path="reports" element={<InventoryReports />} />
            <Route path="stock-transfers" element={<StockTransfers />} />
            <Route path="stock-transfers/new" element={<StockTransferForm />} />
          </Route>

          <Route path="/production" element={<Navigate to={ROUTES.INVENTORY_PRODUCTION} replace />} />
          <Route path="/packaging" element={<Navigate to={ROUTES.INVENTORY_PACKAGING} replace />} />
          <Route path="/inventory/new" element={<Navigate to={ROUTES.INVENTORY_NEW} replace />} />
          <Route path="/inventory/:itemId/edit" element={<LegacyInventoryItemEditRedirect />} />
          <Route path="/inventory/:itemId" element={<LegacyInventoryItemRedirect />} />

          <Route path={ROUTES.CUSTOMERS} element={<Customers />} />
          <Route path={ROUTES.INVOICES} element={<Invoices />} />
          <Route path={ROUTES.PROCUREMENT} element={<ProcurementDashboard />} />
          <Route path={ROUTES.PROCUREMENT_SUPPLIERS} element={<ProcurementSuppliers />} />
          <Route path="/procurement/suppliers/:supplierId" element={<ProcurementSupplierDetail />} />
          <Route path={ROUTES.PROCUREMENT_REQUISITIONS} element={<ProcurementRequisitions />} />
          <Route path={ROUTES.PROCUREMENT_POS} element={<ProcurementPOs />} />
          <Route path={ROUTES.PROCUREMENT_RECEIVING} element={<ProcurementReceiving />} />
          <Route path={ROUTES.PROCUREMENT_FINANCE} element={<ProcurementFinance />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
