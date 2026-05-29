export const ROUTES = {
    DASHBOARD: "/dashboard",

    INVENTORY: "/inventory",
    INVENTORY_CATALOGUE: "/inventory/catalogue",
    INVENTORY_NEW: "/inventory/catalogue/new",
    INVENTORY_DETAIL: (id: string) => `/inventory/catalogue/${id}`,
    INVENTORY_EDIT: (id: string) => `/inventory/catalogue/${id}/edit`,
    INVENTORY_PRODUCTION: "/inventory/production",
    INVENTORY_PACKAGING: "/inventory/packaging",
    INVENTORY_REPORTS: "/inventory/reports",
    INVENTORY_STOCK_TRANSFERS: "/inventory/stock-transfers",
    INVENTORY_STOCK_TRANSFER_NEW: "/inventory/stock-transfers/new",

    /** @deprecated Use INVENTORY_PRODUCTION */
    PRODUCTION: "/inventory/production",
    /** @deprecated Use INVENTORY_PACKAGING */
    PACKAGING: "/inventory/packaging",

    CUSTOMERS: "/customers",
    INVOICES: "/invoices",

    PROCUREMENT: "/procurement",
    PROCUREMENT_SUPPLIERS: "/procurement/suppliers",
    PROCUREMENT_SUPPLIER_NEW: "/procurement/suppliers/new",
    PROCUREMENT_SUPPLIER_DETAIL: (id: string) => `/procurement/suppliers/${id}`,
    PROCUREMENT_REQUISITIONS: "/procurement/requisitions",
    PROCUREMENT_REQUISITION_DETAIL: (id: string) => `/procurement/requisitions/${id}`,
    PROCUREMENT_POS: "/procurement/purchase-orders",
    PROCUREMENT_PO_DETAIL: (id: string) => `/procurement/purchase-orders/${id}`,
    PROCUREMENT_RECEIVING: "/procurement/receiving",
    PROCUREMENT_WEIGHBRIDGE: "/procurement/weighbridge",
    PROCUREMENT_LAB: "/procurement/lab",
    PROCUREMENT_FINANCE: "/procurement/finance",

    ROOT: "/",
} as const;
