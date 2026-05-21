export const PROCUREMENT_EVENTS = {
  SUPPLIER_ONBOARDING_CHANGED: "procurement.supplier.onboarding_changed",
  REQUISITION_SUBMITTED: "procurement.requisition.submitted",
  REQUISITION_APPROVED: "procurement.requisition.approved",
  PO_ISSUED: "procurement.po.issued",
  WEIGHBRIDGE_RECORDED: "procurement.weighbridge.recorded",
  QC_COMPLETED: "procurement.qc.completed",
  GRN_POSTED: "procurement.grn.posted",
  INVENTORY_RECEIPT: "procurement.inventory.receipt",
  THREE_WAY_MATCH_COMPLETED: "procurement.finance.three_way_match",
  PAYMENT_VOUCHER_APPROVED: "procurement.finance.payment_voucher_approved",
  AP_QUEUE_PUSH: "procurement.finance.ap_queue_push",
} as const;

export type ProcurementEventType =
  (typeof PROCUREMENT_EVENTS)[keyof typeof PROCUREMENT_EVENTS];
