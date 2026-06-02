export const SALES_EVENTS = {
  INVENTORY_RESERVE_REQUESTED: "sales.inventory.reserve_requested",
  ORDER_CONFIRMED: "sales.order.confirmed",
  INVOICE_ISSUED: "sales.invoice.issued",
  PAYMENT_RECORDED: "sales.payment.recorded",
} as const;

export type SalesEventType = (typeof SALES_EVENTS)[keyof typeof SALES_EVENTS];
