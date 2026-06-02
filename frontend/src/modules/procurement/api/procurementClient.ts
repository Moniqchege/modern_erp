import { getAccessToken } from "../../../auth/authClient";

const BASE = "/api/procurement";
const SUPPLIERS = "/api/suppliers";

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

export const procurementApi = {
  suppliers: {
    list: (activeOnly?: boolean) =>
      json<{ suppliers: unknown[] }>(`${SUPPLIERS}${activeOnly ? "?activeOnly=true" : ""}`),
    get: (id: string) => json<{ supplier: unknown; documents: unknown[] }>(`${SUPPLIERS}/${id}`),
    create: (body: Record<string, unknown>) =>
      json(`${SUPPLIERS}`, { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      json(`${SUPPLIERS}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    advanceOnboarding: (id: string, actorName: string, notes?: string) =>
      json(`${SUPPLIERS}/${id}/onboarding/advance`, {
        method: "POST",
        body: JSON.stringify({ actorName, notes }),
      }),
    approveOnboarding: (id: string, actorName: string, notes?: string) =>
      json(`${SUPPLIERS}/${id}/onboarding/approve`, {
        method: "POST",
        body: JSON.stringify({ actorName, notes }),
      }),
    rejectOnboarding: (id: string, actorName: string, notes?: string) =>
      json(`${SUPPLIERS}/${id}/onboarding/reject`, {
        method: "POST",
        body: JSON.stringify({ actorName, notes }),
      }),
    createComplianceDocumentsBatch: (id: string, payload: Record<string, unknown>) =>
      json(`${SUPPLIERS}/${id}/documents/batch`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  requisitions: {
    list: (status?: string) =>
      json<{ requisitions: unknown[] }>(`${BASE}/requisitions${status ? `?status=${status}` : ""}`),
    get: (id: string) =>
      json<{ requisition: unknown }>(`${BASE}/requisitions/${id}`),
    create: (body: Record<string, unknown>) =>
      json<{ success: boolean; requisition: { id: string } }>(`${BASE}/requisitions`, { method: "POST", body: JSON.stringify(body) }),
    submit: (id: string) =>
      json(`${BASE}/requisitions/${id}/submit`, { method: "POST" }),
    approve: (id: string, comments?: string) =>
      json(`${BASE}/requisitions/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ comments }),
      }),
    reject: (id: string, reason: string) =>
      json(`${BASE}/requisitions/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    generateLowStock: () =>
      json(`${BASE}/requisitions/low-stock/generate`, { method: "POST" }),
    createPO: (id: string, termsAndConditions?: string, applyVat: boolean = true) =>
      json(`${BASE}/purchase-orders/from-requisition/${id}`, {
        method: "POST",
        body: JSON.stringify({ termsAndConditions, applyVat }),
      }),
  },
  itemProfiles: {
    list: () => json<{ profiles: unknown[] }>(`${BASE}/item-profiles`),
    syncFromInventory: () =>
      json<{ success: boolean } & Record<string, unknown>>(
        `${BASE}/item-profiles/sync-from-inventory`,
        { method: "POST" }
      ),
  },
  purchaseOrders: {
    list: () => json<{ purchaseOrders: unknown[] }>(`${BASE}/purchase-orders`),
    get: (id: string) => json<{ purchaseOrder: unknown }>(`${BASE}/purchase-orders/${id}`),
    fromRequisition: (requisitionId: string, termsAndConditions?: string) =>
      json(`${BASE}/purchase-orders/from-requisition/${requisitionId}`, {
        method: "POST",
        body: JSON.stringify({ termsAndConditions }),
      }),
    issue: (id: string) =>
      json(`${BASE}/purchase-orders/${id}/issue`, { method: "POST" }),
    cancel: (id: string, reason?: string) =>
      json(`${BASE}/purchase-orders/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    updateExpectedDelivery: (id: string, expectedDelivery: string) =>
      json(`${BASE}/purchase-orders/${id}/expected-delivery`, {
        method: "PATCH",
        body: JSON.stringify({ expectedDelivery }),
      }),
  },
  grns: {
    list: () => json<{ grns: unknown[] }>(`${BASE}/grns`),
    get: (id: string) => json<{ grn: unknown }>(`${BASE}/grns/${id}`),
    create: (body: Record<string, unknown>) =>
      json<{ success: boolean; grn: unknown }>(`${BASE}/grns`, { method: "POST", body: JSON.stringify(body) }),
    post: (id: string, postedBy: string) =>
      json<{ success: boolean; grn: unknown }>(`${BASE}/grns/${id}/post`, { method: "POST", body: JSON.stringify({ postedBy }) }),
  },
  weighbridge: {
    create: (body: Record<string, unknown>) =>
      json<{ success: boolean; ticket: unknown }>(`${BASE}/weighbridge/tickets`, { method: "POST", body: JSON.stringify(body) }),
  },
  qc: {
    submitMaize: (body: Record<string, unknown>) =>
      json<{ success: boolean; qc: unknown }>(`${BASE}/qc/maize`, { method: "POST", body: JSON.stringify(body) }),
    submitPackaging: (body: Record<string, unknown>) =>
      json<{ success: boolean; qc: unknown }>(`${BASE}/qc/packaging`, { method: "POST", body: JSON.stringify(body) }),
  },
  finance: {
    /** Register supplier invoice and run 3-way match in one call */
    registerAndMatch: (body: Record<string, unknown>) =>
      json<{ success: boolean; invoice: unknown; match: unknown }>(
        `${BASE}/three-way-match/register-and-match`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    listMatches: () =>
      json<{ success: boolean; matches: unknown[] }>(`${BASE}/three-way-match`),
    getMatch: (id: string) =>
      json<{ success: boolean; match: unknown }>(`${BASE}/three-way-match/${id}`),
    /** Legacy: run match against an already-registered invoice id */
    threeWayMatch: (body: Record<string, unknown>) =>
      json<{ success: boolean; match: unknown }>(`${BASE}/three-way-match`, { method: "POST", body: JSON.stringify(body) }),
    approvePayment: (matchId: string, approverName: string) =>
      json<{ success: boolean; match: unknown; voucher: unknown }>(
        `${BASE}/three-way-match/${matchId}/approve-payment`,
        { method: "POST", body: JSON.stringify({ approverName }) }
      ),
    pushAP: (voucherId: string) =>
      json<{ success: boolean; voucher: unknown }>(
        `${BASE}/payment-vouchers/${voucherId}/push-ap`,
        { method: "POST" }
      ),
  },
};
