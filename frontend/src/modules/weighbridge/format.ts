// Shared formatting helpers for the weighbridge module.

export const fmtKg = (v?: number | string | null, dp = 2) =>
  v == null || v === ""
    ? "—"
    : `${Number(v).toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      })} kg`;

export const fmtNum = (v?: number | string | null, dp = 2) =>
  v == null || v === ""
    ? "—"
    : Number(v).toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      });

export const fmtMoney = (
  v?: number | string | null,
  currency: string = "KES",
  dp = 0
) =>
  v == null || v === ""
    ? "—"
    : `${currency} ${Number(v).toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      })}`;

export const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const fmtDay = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
      })
    : "";

/**
 * Net weight math mirrors the backend:
 *   PURCHASE / OTHERS → vehicle arrives heavy, leaves empty
 *     net = firstWeight - secondWeight
 *   SALE → vehicle arrives empty (tare), leaves loaded (gross)
 *     net = secondWeight - firstWeight
 */
export function calculateNetWeight(
  type: "PURCHASE" | "SALE" | "OTHERS",
  firstWeight: number | null | undefined,
  secondWeight: number | null | undefined
): number | null {
  if (firstWeight == null || secondWeight == null) return null;
  if (type === "SALE") return Number((secondWeight - firstWeight).toFixed(3));
  return Number((firstWeight - secondWeight).toFixed(3));
}

export const ticketTypeLabel = (t: "PURCHASE" | "SALE" | "OTHERS") =>
  t === "PURCHASE" ? "Purchase" : t === "SALE" ? "Sale" : "Others";

export const statusBadgeClass = (s: "PENDING" | "COMPLETED" | "CANCELLED") =>
  s === "COMPLETED"
    ? "bg-emerald-100 text-emerald-700"
    : s === "CANCELLED"
    ? "bg-rose-100 text-rose-700"
    : "bg-amber-100 text-amber-700";
