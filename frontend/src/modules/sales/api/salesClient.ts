import { getAccessToken } from "../../../auth/authClient";
import type {
  Customer,
  CustomerPayment,
  DispatchLog,
  Invoice,
  SalesDashboard,
  SalesOrder,
  SalesProduct,
} from "../types/sales";

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? `Request failed: ${res.status}`);
  return data as T;
}

function qs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const salesApi = {
  dashboard: {
    get: () => json<{ dashboard: SalesDashboard }>("/api/sales/dashboard"),
  },
  customers: {
    list: (params?: { type?: string; status?: string; creditStatus?: string }) =>
      json<{ customers: Customer[] }>(
        `/api/customers${qs({
          type: params?.type,
          status: params?.status,
          creditStatus: params?.creditStatus,
        })}`
      ),
    get: (id: string) => json<{ customer: Customer }>(`/api/customers/${id}`),
    create: (body: Partial<Customer>) =>
      json<{ customer: Customer }>("/api/customers", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id: string, body: Partial<Customer>) =>
      json<{ customer: Customer }>(`/api/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  products: {
    list: () => json<{ products: SalesProduct[] }>("/api/sales-products"),
  },
  orders: {
    list: (params?: {
      customerId?: string;
      orderStatus?: string;
      dispatchStatus?: string;
      paymentStatus?: string;
    }) =>
      json<{ orders: SalesOrder[] }>(
        `/api/sales-orders${qs({
          customerId: params?.customerId,
          orderStatus: params?.orderStatus,
          dispatchStatus: params?.dispatchStatus,
          paymentStatus: params?.paymentStatus,
        })}`
      ),
    get: (id: string) => json<{ order: SalesOrder }>(`/api/sales-orders/${id}`),
    create: (body: {
      customerId: string;
      items: Array<{ productSku: string; quantity: number }>;
      orderDate?: string;
    }) =>
      json<{ order: SalesOrder }>("/api/sales-orders", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (
      id: string,
      body: { orderStatus?: string; dispatchStatus?: string }
    ) =>
      json<{ order: SalesOrder }>(`/api/sales-orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    cancel: (id: string) =>
      json<{ order: SalesOrder }>(`/api/sales-orders/${id}/cancel`, {
        method: "POST",
      }),
  },
  invoices: {
    list: (params?: { customerId?: string; status?: string }) =>
      json<{ invoices: Invoice[] }>(
        `/api/invoices${qs({
          customerId: params?.customerId,
          status: params?.status,
        })}`
      ),
    get: (id: string) => json<{ invoice: Invoice }>(`/api/invoices/${id}`),
    generate: (body: { salesOrderId: string; createdById?: string }) =>
      json<{ invoice: Invoice }>("/api/invoices/generate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    createLegacy: (body: Record<string, unknown>) =>
      json<{ invoice: Invoice }>("/api/invoices", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  payments: {
    list: (params?: { customerId?: string; invoiceId?: string }) =>
      json<{ payments: CustomerPayment[] }>(
        `/api/payments${qs({
          customerId: params?.customerId,
          invoiceId: params?.invoiceId,
        })}`
      ),
    record: (body: {
      customerId: string;
      invoiceId: string;
      amountPaid: number;
      paymentMethod: string;
      transactionReference?: string | null;
    }) =>
      json<{
        payment: CustomerPayment;
        invoice: Invoice;
        totalPaid: number;
      }>("/api/payments", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  dispatches: {
    list: (params?: { customerId?: string; status?: string }) =>
      json<{ dispatches: DispatchLog[] }>(
        `/api/dispatches${qs({
          customerId: params?.customerId,
          status: params?.status,
        })}`
      ),
    get: (id: string) => json<{ dispatch: DispatchLog }>(`/api/dispatches/${id}`),
    create: (body: Record<string, unknown>) =>
      json<{ dispatch: DispatchLog }>("/api/dispatches", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateStatus: (id: string, body: { status: string }) =>
      json<{ dispatch: DispatchLog }>(`/api/dispatches/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    availablePallets: () =>
      json<{
        pallets: Array<{ id: string; palletBarcode: string; batchNumber: string | null }>;
      }>("/api/dispatches/pallets/available"),
  },
};
