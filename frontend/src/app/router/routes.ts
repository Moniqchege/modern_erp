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
    INVENTORY_STOCK_TRANSFER_DETAIL: (id: string) => `/inventory/stock-transfers/${id}`,
    INVENTORY_STORES: "/inventory/stores",
    INVENTORY_BALE_TRANSFERS: "/inventory/bale-transfers",
    INVENTORY_BALE_TRANSFER_DETAIL: (id: string) => `/inventory/bale-transfers/${id}`,
    INVENTORY_DISPATCH_STORE: "/inventory/dispatch-store",

    /** @deprecated Use INVENTORY_PRODUCTION */
    PRODUCTION: "/inventory/production",
    /** @deprecated Use INVENTORY_PACKAGING */
    PACKAGING: "/inventory/packaging",

    /** @deprecated Use SALES_CUSTOMERS */
    CUSTOMERS: "/customers",
    /** @deprecated Use SALES_INVOICES */
    INVOICES: "/invoices",

    SALES: "/sales",
    SALES_CUSTOMERS: "/sales/customers",
    SALES_CUSTOMER_DETAIL: (id: string) => `/sales/customers/${id}`,
    SALES_ORDERS: "/sales/orders",
    SALES_ORDER_DETAIL: (id: string) => `/sales/orders/${id}`,
    SALES_ORDER_NEW: "/sales/orders/new",
    SALES_PRODUCTS: "/sales/products",
    SALES_INVOICES: "/sales/invoices",
    SALES_INVOICE_DETAIL: (id: string) => `/sales/invoices/${id}`,
    SALES_PAYMENTS: "/sales/payments",
    SALES_DISPATCHES: "/sales/dispatches",
    SALES_DISPATCH_DETAIL: (id: string) => `/sales/dispatches/${id}`,
    SALES_DISPATCH_NEW: "/sales/dispatches/new",

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
    PROCUREMENT_REPORTS: "/procurement/reports",

    BUDGET: "/budget-imprest",
    BUDGET_ALLOCATIONS: "/budget-imprest/allocations",
    BUDGET_IMPRESTS: "/budget-imprest/imprests",
    BUDGET_SURRENDERS: "/budget-imprest/surrenders",

    FINANCE: "/finance",
    FINANCE_ACCOUNTS: "/finance/accounts",
    FINANCE_JOURNALS: "/finance/journals",
    FINANCE_REPORTS: "/finance/reports",

    ROOT: "/",
} as const;
