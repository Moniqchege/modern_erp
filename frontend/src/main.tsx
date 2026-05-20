import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { Layout, NavKey } from "./layouts/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/inventory/Inventory";
import { ProductionForm } from "./pages/ProductionForm";
import { Customers } from "./pages/Customers";
import { Invoices } from "./pages/Invoices";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState<NavKey>("dashboard");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onNavigate={setActiveTab} />;
      case "inventory":
        return <Inventory />;
      case "production":
        return <ProductionForm />;
      case "customers":
        return <Customers />;
      case "invoices":
        return <Invoices />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
