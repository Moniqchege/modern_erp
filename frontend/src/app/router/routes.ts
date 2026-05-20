export const ROUTES = {
    DASHBOARD: "/dashboard",

    INVENTORY: "/inventory",
    INVENTORY_NEW: "/inventory/new",
    INVENTORY_DETAIL: (id: string) => `/inventory/${id}`,
    INVENTORY_EDIT: (id: string) => `/inventory/${id}/edit`,

    PRODUCTION: "/production",
    CUSTOMERS: "/customers",
    INVOICES: "/invoices",

    ROOT: "/",
} as const;

