export const ROUTES = {
    DASHBOARD: "/dashboard",

    INVENTORY: "/inventory",
    INVENTORY_NEW: "/inventory/new",
    INVENTORY_DETAIL: (id: string) => `/inventory/${id}`,
    INVENTORY_EDIT: (id: string) => `/inventory/${id}/edit`,

    PRODUCTION: "/production",
    CUSTOMERS: "/customers",
    INVOICES: "/invoices",

    PROCUREMENT: "/procurement",
    PROCUREMENT_SUPPLIERS: "/procurement/suppliers",
    PROCUREMENT_SUPPLIER_NEW: "/procurement/suppliers/new",
    PROCUREMENT_SUPPLIER_DETAIL: (id: string) => `/procurement/suppliers/${id}`,
    PROCUREMENT_REQUISITIONS: "/procurement/requisitions",
    PROCUREMENT_POS: "/procurement/purchase-orders",
    PROCUREMENT_RECEIVING: "/procurement/receiving",
    PROCUREMENT_FINANCE: "/procurement/finance",

    ROOT: "/",
} as const;

