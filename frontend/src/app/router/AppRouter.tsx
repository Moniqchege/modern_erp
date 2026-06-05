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
const StockTransferDetail = lazy(() =>
  import("../../pages/inventory/StockTransferDetail").then((m) => ({ default: m.StockTransferDetail }))
);
const Stores = lazy(() =>
  import("../../pages/inventory/Stores").then((m) => ({ default: m.Stores }))
);
const BaleTransfers = lazy(() =>
  import("../../pages/inventory/BaleTransfers").then((m) => ({ default: m.BaleTransfers }))
);
const BaleTransferForm = lazy(() =>
  import("../../pages/inventory/BaleTransferForm").then((m) => ({ default: m.BaleTransferForm }))
);
const BaleTransferDetail = lazy(() =>
  import("../../pages/inventory/BaleTransferDetail").then((m) => ({ default: m.BaleTransferDetail }))
);
const DispatchStoreDashboard = lazy(() =>
  import("../../pages/inventory/DispatchStoreDashboard").then((m) => ({ default: m.DispatchStoreDashboard }))
);
const SalesDashboard = lazy(() =>
  import("../../pages/sales/SalesDashboard").then((m) => ({ default: m.SalesDashboard }))
);
const SalesCustomers = lazy(() =>
  import("../../pages/sales/Customers").then((m) => ({ default: m.Customers }))
);
const SalesCustomerDetail = lazy(() =>
  import("../../pages/sales/CustomerDetail").then((m) => ({ default: m.CustomerDetail }))
);
const SalesOrders = lazy(() =>
  import("../../pages/sales/SalesOrders").then((m) => ({ default: m.SalesOrders }))
);
const SalesOrderForm = lazy(() =>
  import("../../pages/sales/SalesOrderForm").then((m) => ({ default: m.SalesOrderForm }))
);
const SalesOrderDetail = lazy(() =>
  import("../../pages/sales/SalesOrderDetail").then((m) => ({ default: m.SalesOrderDetail }))
);
const SalesProducts = lazy(() =>
  import("../../pages/sales/Products").then((m) => ({ default: m.Products }))
);
const SalesInvoices = lazy(() =>
  import("../../pages/sales/Invoices").then((m) => ({ default: m.Invoices }))
);
const SalesInvoiceDetail = lazy(() =>
  import("../../pages/sales/InvoiceDetail").then((m) => ({ default: m.InvoiceDetail }))
);
const SalesPayments = lazy(() =>
  import("../../pages/sales/Payments").then((m) => ({ default: m.Payments }))
);
const SalesDispatches = lazy(() =>
  import("../../pages/sales/Dispatches").then((m) => ({ default: m.Dispatches }))
);
const SalesDispatchForm = lazy(() =>
  import("../../pages/sales/DispatchForm").then((m) => ({ default: m.DispatchForm }))
);
const SalesDispatchDetail = lazy(() =>
  import("../../pages/sales/DispatchDetail").then((m) => ({ default: m.DispatchDetail }))
);
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
const ProcurementRequisitionDetail = lazy(() =>
  import("../../pages/procurement/RequisitionDetail").then((m) => ({ default: m.RequisitionDetail }))
);
const ProcurementPOs = lazy(() =>
  import("../../pages/procurement/PurchaseOrders").then((m) => ({ default: m.PurchaseOrders }))
);
const ProcurementPODetail = lazy(() =>
  import("../../pages/procurement/PurchaseOrderDetail").then((m) => ({ default: m.PurchaseOrderDetail }))
);
const ProcurementReceiving = lazy(() =>
  import("../../pages/procurement/GRNManagement").then((m) => ({ default: m.GRNManagement }))
);
const ProcurementWeighbridge = lazy(() =>
  import("../../pages/procurement/Weighbridge").then((m) => ({ default: m.Weighbridge }))
);
const ProcurementLab = lazy(() =>
  import("../../pages/procurement/Lab").then((m) => ({ default: m.Lab }))
);
const ProcurementWeighbridgeOutbound = lazy(() =>
  import("../../pages/procurement/WeighbridgeOutbound").then((m) => ({ default: m.WeighbridgeOutbound }))
);
const ProcurementFinance = lazy(() =>
  import("../../pages/procurement/ThreeWayMatch").then((m) => ({ default: m.ThreeWayMatch }))
);
const ProcurementReports = lazy(() =>
  import("../../pages/procurement/ProcurementReports").then((m) => ({ default: m.ProcurementReports }))
);

const BudgetDashboard = lazy(() =>
  import("../../pages/budget/BudgetDashboard").then((m) => ({ default: m.BudgetDashboard }))
);
const BudgetAllocations = lazy(() =>
  import("../../pages/budget/BudgetAllocations").then((m) => ({ default: m.BudgetAllocations }))
);
const ImprestRequests = lazy(() =>
  import("../../pages/budget/ImprestRequests").then((m) => ({ default: m.ImprestRequests }))
);
const ImprestSurrenders = lazy(() =>
  import("../../pages/budget/ImprestSurrenders").then((m) => ({ default: m.ImprestSurrenders }))
);

const FinanceDashboard = lazy(() =>
  import("../../pages/finance/FinanceDashboard").then((m) => ({ default: m.FinanceDashboard }))
);
const ChartOfAccounts = lazy(() =>
  import("../../pages/finance/ChartOfAccounts").then((m) => ({ default: m.ChartOfAccounts }))
);
const JournalEntries = lazy(() =>
  import("../../pages/finance/JournalEntries").then((m) => ({ default: m.JournalEntries }))
);
const FinancialReports = lazy(() =>
  import("../../pages/finance/FinancialReports").then((m) => ({ default: m.FinancialReports }))
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
            <Route path="stock-transfers/:transferId" element={<StockTransferDetail />} />
            <Route path="stores" element={<Stores />} />
            <Route path="bale-transfers" element={<BaleTransfers />} />
            <Route path="bale-transfers/push" element={<BaleTransferForm />} />
            <Route path="bale-transfers/pull" element={<BaleTransferForm />} />
            <Route path="bale-transfers/:transferId" element={<BaleTransferDetail />} />
            <Route path="dispatch-store" element={<DispatchStoreDashboard />} />
          </Route>

          <Route path="/production" element={<Navigate to={ROUTES.INVENTORY_PRODUCTION} replace />} />
          <Route path="/packaging" element={<Navigate to={ROUTES.INVENTORY_PACKAGING} replace />} />
          <Route path="/inventory/new" element={<Navigate to={ROUTES.INVENTORY_NEW} replace />} />
          <Route path="/inventory/:itemId/edit" element={<LegacyInventoryItemEditRedirect />} />
          <Route path="/inventory/:itemId" element={<LegacyInventoryItemRedirect />} />

          <Route path={ROUTES.SALES} element={<SalesDashboard />} />
          <Route path={ROUTES.SALES_CUSTOMERS} element={<SalesCustomers />} />
          <Route path="/sales/customers/:customerId" element={<SalesCustomerDetail />} />
          <Route path={ROUTES.SALES_ORDERS} element={<SalesOrders />} />
          <Route path={ROUTES.SALES_ORDER_NEW} element={<SalesOrderForm />} />
          <Route path="/sales/orders/:orderId" element={<SalesOrderDetail />} />
          <Route path={ROUTES.SALES_PRODUCTS} element={<SalesProducts />} />
          <Route path={ROUTES.SALES_INVOICES} element={<SalesInvoices />} />
          <Route path="/sales/invoices/:invoiceId" element={<SalesInvoiceDetail />} />
          <Route path={ROUTES.SALES_PAYMENTS} element={<SalesPayments />} />
          <Route path={ROUTES.SALES_DISPATCHES} element={<SalesDispatches />} />
          <Route path={ROUTES.SALES_DISPATCH_NEW} element={<SalesDispatchForm />} />
          <Route path="/sales/dispatches/:dispatchId" element={<SalesDispatchDetail />} />

          <Route path={ROUTES.CUSTOMERS} element={<Navigate to={ROUTES.SALES_CUSTOMERS} replace />} />
          <Route path={ROUTES.INVOICES} element={<Navigate to={ROUTES.SALES_INVOICES} replace />} />
          <Route path={ROUTES.PROCUREMENT} element={<ProcurementDashboard />} />
          <Route path={ROUTES.PROCUREMENT_SUPPLIERS} element={<ProcurementSuppliers />} />
          <Route path="/procurement/suppliers/:supplierId" element={<ProcurementSupplierDetail />} />
          <Route path={ROUTES.PROCUREMENT_REQUISITIONS} element={<ProcurementRequisitions />} />
          <Route path="/procurement/requisitions/:requisitionId" element={<ProcurementRequisitionDetail />} />
          <Route path={ROUTES.PROCUREMENT_POS} element={<ProcurementPOs />} />
          <Route path="/procurement/purchase-orders/:poId" element={<ProcurementPODetail />} />
          <Route path={ROUTES.PROCUREMENT_RECEIVING} element={<ProcurementReceiving />} />
          <Route path={ROUTES.PROCUREMENT_WEIGHBRIDGE} element={<ProcurementWeighbridge />} />
          <Route path={ROUTES.PROCUREMENT_LAB} element={<ProcurementLab />} />
          <Route path="/procurement/weighbridge/outbound" element={<ProcurementWeighbridgeOutbound />} />
          <Route path={ROUTES.PROCUREMENT_FINANCE} element={<ProcurementFinance />} />
          <Route path={ROUTES.PROCUREMENT_REPORTS} element={<ProcurementReports />} />

          <Route path={ROUTES.BUDGET}>
            <Route index element={<BudgetDashboard />} />
            <Route path="allocations" element={<BudgetAllocations />} />
            <Route path="imprests" element={<ImprestRequests />} />
            <Route path="surrenders" element={<ImprestSurrenders />} />
          </Route>

          <Route path={ROUTES.FINANCE}>
            <Route index element={<FinanceDashboard />} />
            <Route path="accounts" element={<ChartOfAccounts />} />
            <Route path="journals" element={<JournalEntries />} />
            <Route path="reports" element={<FinancialReports />} />
          </Route>

          <Route path="*" element={<NotFound />} />

        </Route>
      </Routes>
    </Suspense>
  );
}
