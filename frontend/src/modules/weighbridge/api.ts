import { getAccessToken } from "../../auth/authClient";
import type {
  CancelTicketDto,
  CaptureSecondWeightDto,
  CompleteOthersTicketDto,
  CreateOthersTicketDto,
  CreatePurchaseTicketDto,
  CreateSaleTicketDto,
  ListResponse,
  PendingTicketSummary,
  PurchaseOrderLookup,
  SalesOrderLookup,
  TruckMasterRecord,
  WeighbridgeDashboardData,
  WeighbridgeTicketFilters,
  WeighbridgeTicketRecord,
} from "./types";

const BASE = "/api/weighbridge";
const PROC = "/api/procurement";
const SALES = "/api/sales-orders";

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
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    const msg =
      (body && (body.error || body.message)) ||
      `Request failed: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return body as T;
}

function qs(filters?: Record<string, unknown>): string {
  if (!filters) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      parts.push(`${encodeURIComponent(k)}=${v.map(encodeURIComponent).join(",")}`);
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export const weighbridgeApi = {
  // ─── Tickets ─────────────────────────────────────────────────────────────
  tickets: {
    list: (filters?: WeighbridgeTicketFilters) =>
      json<{ success: boolean; data: ListResponse<WeighbridgeTicketRecord> }>(
        `${BASE}/tickets${qs(filters as any)}`
      ),
    get: (id: string) =>
      json<{ success: boolean; data: WeighbridgeTicketRecord }>(
        `${BASE}/tickets/${id}`
      ),
    pending: () =>
      json<{ success: boolean; data: PendingTicketSummary[] }>(
        `${BASE}/tickets/pending`
      ),
    createPurchase: (dto: CreatePurchaseTicketDto) =>
      json<{ success: boolean; data: WeighbridgeTicketRecord }>(
        `${BASE}/tickets/purchase`,
        { method: "POST", body: JSON.stringify(dto) }
      ),
    createSale: (dto: CreateSaleTicketDto) =>
      json<{ success: boolean; data: WeighbridgeTicketRecord }>(
        `${BASE}/tickets/sale`,
        { method: "POST", body: JSON.stringify(dto) }
      ),
    createOthers: (dto: CreateOthersTicketDto) =>
      json<{ success: boolean; data: WeighbridgeTicketRecord }>(
        `${BASE}/tickets/others`,
        { method: "POST", body: JSON.stringify(dto) }
      ),
    captureSecondWeight: (id: string, dto: CaptureSecondWeightDto) =>
      json<{ success: boolean; data: WeighbridgeTicketRecord }>(
        `${BASE}/tickets/${id}/second-weight`,
        { method: "POST", body: JSON.stringify(dto) }
      ),
    completeOthers: (id: string, dto: CompleteOthersTicketDto) =>
      json<{ success: boolean; data: WeighbridgeTicketRecord }>(
        `${BASE}/tickets/${id}/complete-others`,
        { method: "POST", body: JSON.stringify(dto) }
      ),
    cancel: (id: string, dto: CancelTicketDto) =>
      json<{ success: boolean; data: WeighbridgeTicketRecord }>(
        `${BASE}/tickets/${id}/cancel`,
        { method: "POST", body: JSON.stringify(dto) }
      ),
  },

  // ─── Dashboard ───────────────────────────────────────────────────────────
  dashboard: (dateFrom?: string, dateTo?: string) =>
    json<{ success: boolean; data: WeighbridgeDashboardData }>(
      `${BASE}/dashboard${qs({ dateFrom, dateTo })}`
    ),

  // ─── Truck master ────────────────────────────────────────────────────────
  trucks: {
    list: () =>
      json<{ success: boolean; data: TruckMasterRecord[] }>(
        `${BASE}/trucks`
      ),
    assignDriver: (id: string, driverName: string) =>
      json<{ success: boolean; data: TruckMasterRecord }>(
        `${BASE}/trucks/${id}/assign-driver`,
        { method: "POST", body: JSON.stringify({ driverName }) }
      ),
  },

  // ─── ERP lookups for the header dropdowns ────────────────────────────────
  // POs come from the procurement module
  purchaseOrders: {
    list: () =>
      json<{ success: boolean; purchaseOrders: any[] }>(`${PROC}/purchase-orders`),
    get: (id: string) =>
      json<{ success: boolean; purchaseOrder: any }>(`${PROC}/purchase-orders/${id}`),
  },

  // SOs come from the sales-orders module
  salesOrders: {
    list: () => json<{ success: boolean; salesOrders: any[] }>(`${SALES}`),
    get: (id: string) =>
      json<{ success: boolean; salesOrder: any }>(`${SALES}/${id}`),
  },
};

// ─── Helpers used by the UI ─────────────────────────────────────────────────

/**
 * Coerce a PO record from the procurement module into our lookup shape.
 * Heuristic: sum of (lines[].quantity * unit factor) when present, else totalAmount as a fallback.
 */
export function toPurchaseOrderLookup(p: any): PurchaseOrderLookup {
  let orderedQtyKg: number | undefined;
  if (Array.isArray(p?.lines) && p.lines.length) {
    try {
      orderedQtyKg = p.lines.reduce(
        (s: number, l: any) => s + Number(l.quantity || 0),
        0
      );
    } catch {
      orderedQtyKg = undefined;
    }
  }
  return {
    id: p.id,
    poNumber: p.poNumber,
    status: p.status,
    totalAmount: Number(p.totalAmount ?? 0),
    currency: p.currency ?? "KES",
    supplier: p.supplier ? { id: p.supplier.id, name: p.supplier.name } : undefined,
    orderedQtyKg,
  };
}

export function toSalesOrderLookup(s: any): SalesOrderLookup {
  let itemCount: number | undefined;
  if (Array.isArray(s?.items)) itemCount = s.items.length;
  else if (Array.isArray(s?.lines)) itemCount = s.lines.length;
  return {
    id: s.id,
    orderNumber: s.orderNumber ?? s.salesOrderNumber ?? `SO-${s.id?.slice(-6)}`,
    status: s.status,
    totalAmount: Number(s.totalAmount ?? 0),
    currency: s.currency ?? "KES",
    customer: s.customer
      ? { id: s.customer.id, name: s.customer.name }
      : undefined,
    itemCount,
  };
}
