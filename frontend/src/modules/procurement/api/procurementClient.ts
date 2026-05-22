const BASE = "/api/procurement";
const SUPPLIERS = "/api/suppliers";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...init?.headers },
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
    create: (body: Record<string, unknown>) =>
      json(`${BASE}/requisitions`, { method: "POST", body: JSON.stringify(body) }),
    submit: (id: string, approverName: string) =>
      json(`${BASE}/requisitions/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ approverName }),
      }),
    approve: (id: string, level: string, approverName: string) =>
      json(`${BASE}/requisitions/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ level, approverName }),
      }),
  },
  purchaseOrders: {
    list: () => json<{ purchaseOrders: unknown[] }>(`${BASE}/purchase-orders`),
    fromRequisition: (requisitionId: string, issuedBy: string) =>
      json(`${BASE}/purchase-orders/from-requisition/${requisitionId}`, {
        method: "POST",
        body: JSON.stringify({ issuedBy }),
      }),
    issue: (id: string, issuedBy: string) =>
      json(`${BASE}/purchase-orders/${id}/issue`, {
        method: "POST",
        body: JSON.stringify({ issuedBy }),
      }),
  },
  grns: {
    list: () => json<{ grns: unknown[] }>(`${BASE}/grns`),
    post: (id: string, postedBy: string) =>
      json(`${BASE}/grns/${id}/post`, { method: "POST", body: JSON.stringify({ postedBy }) }),
  },
  qc: {
    submitMaize: (body: Record<string, unknown>) =>
      json(`${BASE}/qc/maize`, { method: "POST", body: JSON.stringify(body) }),
  },
  finance: {
    threeWayMatch: (body: Record<string, unknown>) =>
      json(`${BASE}/three-way-match`, { method: "POST", body: JSON.stringify(body) }),
  },
};
