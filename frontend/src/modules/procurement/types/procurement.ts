export type ProcurementCategory =
  | "RAW_MATERIAL"
  | "PACKAGING"
  | "MILLING_CONSUMABLE"
  | "ENGINEERING_SPARE";

export type SupplierOnboardingStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export type SupplierStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

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

export type GrainIntakeGrnStatus =
  | "WEIGHED_IN"
  | "PENDING_QC"
  | "READY_TO_UNLOAD"
  | "WEIGHED_OUT"
  | "REJECTED";

export interface GrainIntakeGrnRecord {
  id: string;
  grnNumber: string;
  status: GrainIntakeGrnStatus;
  truckLicensePlate: string;
  supplierName: string;
  driverName?: string;
  grossWeightKg: number;
  tareWeightKg?: number;
  netWeightKg?: number;
  moistureContentPct?: number;
  aflatoxinPpb?: number;
  technicianUserId?: string;
  rejectionReason?: string;
  weighedInAt: string;
  weighedOutAt?: string;
}

export type GrainIntakeGrnStateMachine = {
  WEIGHED_IN: {
    allowedNext: ["PENDING_QC"];
    required: Pick<
      GrainIntakeGrnRecord,
      "truckLicensePlate" | "supplierName" | "grossWeightKg" | "weighedInAt"
    >;
  };
  PENDING_QC: {
    allowedNext: ["READY_TO_UNLOAD", "REJECTED"];
    required: Pick<
      GrainIntakeGrnRecord,
      "truckLicensePlate" | "supplierName" | "grossWeightKg" | "technicianUserId"
    > & {
      moistureContentPct: number;
      aflatoxinPpb: number;
    };
  };
  READY_TO_UNLOAD: {
    allowedNext: ["WEIGHED_OUT"];
    required: Pick<
      GrainIntakeGrnRecord,
      "grossWeightKg" | "moistureContentPct" | "aflatoxinPpb" | "technicianUserId"
    >;
  };
  REJECTED: {
    allowedNext: ["WEIGHED_OUT"];
    required: Pick<
      GrainIntakeGrnRecord,
      "grossWeightKg" | "moistureContentPct" | "aflatoxinPpb" | "technicianUserId" | "rejectionReason"
    >;
  };
  WEIGHED_OUT: {
    allowedNext: [];
    required: Pick<GrainIntakeGrnRecord, "grossWeightKg" | "tareWeightKg" | "netWeightKg" | "weighedOutAt">;
  };
};

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
  status: SupplierStatus;
  isActive?: boolean;
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
  rejectionReason?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
  lines?: Array<{
    itemProfile: { name: string; category: ProcurementCategory };
    quantity: string | number;
    unitPriceEstimate?: string | number | null;
    lineTotalEstimate?: string | number | null;
  }>;
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
