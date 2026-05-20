import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "./Layout";
import { ROUTES } from "../app/router/routes";

type SidebarKey = "dashboard" | "inventory" | "production" | "customers" | "invoices";

function getSidebarKeyFromPath(pathname: string): SidebarKey {
  if (pathname === "/" || pathname.startsWith(ROUTES.DASHBOARD)) return "dashboard";
  if (pathname.startsWith(ROUTES.INVENTORY)) return "inventory";
  if (pathname.startsWith(ROUTES.PRODUCTION)) return "production";
  if (pathname.startsWith(ROUTES.CUSTOMERS)) return "customers";
  if (pathname.startsWith(ROUTES.INVOICES)) return "invoices";
  return "dashboard";
}

export function LayoutShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getSidebarKeyFromPath(location.pathname);

  const handleSetActiveTab = (tab: SidebarKey) => {
    switch (tab) {
      case "dashboard":
        navigate(ROUTES.DASHBOARD);
        return;
      case "inventory":
        navigate(ROUTES.INVENTORY);
        return;
      case "production":
        navigate(ROUTES.PRODUCTION);
        return;
      case "customers":
        navigate(ROUTES.CUSTOMERS);
        return;
      case "invoices":
        navigate(ROUTES.INVOICES);
        return;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={handleSetActiveTab}>
      <Outlet />
    </Layout>
  );
}


