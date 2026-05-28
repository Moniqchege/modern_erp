export type ProcurementCategory =
  | "RAW_MATERIAL"
  | "PACKAGING"
  | "MILLING_CONSUMABLE"
  | "ENGINEERING_SPARE";

export type SupplierOnboardingStatus =
  | "DRAFT"
  | "QA_AUDIT"
  | "FINANCE_APPROVAL"
  | "ACTIVE"
  | "SUSPENDED"
  | "REJECTED";

export type ComplianceDocumentStatus = "ACTIVE" | "EXPIRING_SOON" | "NON_COMPLIANT";

export type RequisitionStatus =
  | "DRAFT"
  | "PENDING_HEAD_PROCUREMENT"
  | "PENDING_FINANCE"
  | "APPROVED"
  | "REJECTED"
  | "CONVERTED_TO_PO"
  | "CANCELLED";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_RECEIVED"
  | "FULLY_RECEIVED"
  | "CLOSED"
  | "CANCELLED";

export type ProcurementQCStatus =
  | "PENDING"
  | "PASSED"
  | "FAILED_CONDITIONAL"
  | "FULL_REJECTION";

export type GrnStatus = "DRAFT" | "PENDING_QC" | "POSTED" | "REJECTED" | "CANCELLED";

export type ThreeWayMatchStatus =
  | "PENDING"
  | "MATCHED"
  | "PRICE_DISCREPANCY"
  | "QUANTITY_DISCREPANCY"
  | "BOTH_DISCREPANCY"
  | "APPROVED_FOR_PAYMENT"
  | "REJECTED";

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  onboardingStatus: SupplierOnboardingStatus;
  isActive: boolean;
  taxPin?: string | null;
  vatNumber?: string | null;
  suppliedItems?: SupplierSuppliedItem[];
}

export interface ProcurementItemProfile {
  id: string;
  sku: string;
  name: string;
  category: ProcurementCategory;
  unit: string;
}

export interface SupplierSuppliedItem {
  id: string;
  itemProfileId: string;
  itemProfile: ProcurementItemProfile;
  isPreferred: boolean;
  leadTimeDays?: number | null;
  minOrderQty?: string | number | null;
  lastUnitPrice?: string | number | null;
  notes?: string | null;
}

export interface PurchaseRequisition {
  id: string;
  requisitionNo: string;
  status: RequisitionStatus;
  requestedBy: string;
  estimatedTotal: string | number;
  currency: string;
  supplierId?: string | null;
  supplier?: Supplier | null;
  source?: "LOW_STOCK_AUTO" | "MANUAL_PLANT" | "MANUAL_PROCUREMENT";
  department?: string | null;
  requiredByDate?: string | null;
  justification?: string | null;
  lines?: Array<{ itemProfile: { name: string; category: ProcurementCategory } }>;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  totalAmount: string | number;
  currency: string;
  supplier?: Supplier;
  expectedDelivery?: string | null;
}

export interface GoodsReceivedNote {
  id: string;
  grnNumber: string;
  status: GrnStatus;
  deliverySequence: number;
  batchTraceCode?: string | null;
  receivedAt: string;
  purchaseOrder?: PurchaseOrder;
  qcResults?: Array<{ status: ProcurementQCStatus }>;
}

export interface ThreeWayMatch {
  id: string;
  matchNumber: string;
  status: ThreeWayMatchStatus;
  priceVariancePct?: string | number | null;
  quantityVariancePct?: string | number | null;
}
