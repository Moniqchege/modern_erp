// Mirrors backend/src/types/weighbridge.ts
export type WeighbridgeTicketType = "PURCHASE" | "SALE" | "OTHERS";
export type WeighbridgeTicketStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type WeighbridgePaymentMethod = "CASH" | "MOBILE_MONEY" | "ON_ACCOUNT";

// ─── Request DTOs ───────────────────────────────────────────────────────────

export interface CreatePurchaseTicketDto {
  purchaseOrderId?: string;
  supplierName: string;
  supplierDriverName?: string;
  vehiclePlate: string;
  driverName: string;
  firstWeightKg: number;
  isManual?: boolean;
  operatorName?: string;
}

export interface CreateSaleTicketDto {
  salesOrderId?: string;
  customerName: string;
  truckMasterId: string;
  firstWeightKg: number;
  isManual?: boolean;
  operatorName?: string;
}

export interface CreateOthersTicketDto {
  customerName: string;
  vehiclePlate: string;
  driverName: string;
  serviceDescription: string;
  firstWeightKg: number;
  isManual?: boolean;
  operatorName?: string;
}

export interface CaptureSecondWeightDto {
  secondWeightKg: number;
  isManual?: boolean;
}

export interface CompleteOthersTicketDto {
  secondWeightKg: number;
  paymentMethod: WeighbridgePaymentMethod;
  amountCharged: number;
  receiptReference?: string;
  isManual?: boolean;
}

export interface CancelTicketDto {
  reason: string;
  cancelledByUserId?: string;
}

// ─── Filters ────────────────────────────────────────────────────────────────

export interface WeighbridgeTicketFilters {
  status?: WeighbridgeTicketStatus | WeighbridgeTicketStatus[];
  type?: WeighbridgeTicketType | WeighbridgeTicketType[];
  vehiclePlate?: string;
  dateFrom?: string;
  dateTo?: string;
  isManual?: boolean;
  page?: number;
  limit?: number;
}

// ─── Response shapes ────────────────────────────────────────────────────────

export interface WeighbridgeTicketRecord {
  id: string;
  ticketNumber: string;
  type: WeighbridgeTicketType;
  status: WeighbridgeTicketStatus;
  purchaseOrderId?: string | null;
  supplierName?: string | null;
  supplierDriverName?: string | null;
  salesOrderId?: string | null;
  customerName?: string | null;
  truckMasterId?: string | null;
  assignedDriverName?: string | null;
  vehiclePlate?: string | null;
  driverName?: string | null;
  firstWeightKg?: number | null;
  firstWeightAt?: string | null;
  secondWeightKg?: number | null;
  secondWeightAt?: string | null;
  netWeightKg?: number | null;
  tareVarianceKg?: number | null;
  varianceFlagged: boolean;
  isManual: boolean;
  serviceDescription?: string | null;
  paymentMethod?: string | null;
  amountCharged?: number | null;
  receiptReference?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  operatorName?: string | null;
  createdAt: string;
  updatedAt: string;
  purchaseOrder?: { poNumber: string; supplier?: { name: string } } | null;
  salesOrder?: { orderNumber: string; customer?: { name: string } } | null;
  truckMaster?: {
    licensePlate: string;
    model: string;
    masterTareKg: number;
  } | null;
}

export interface PendingTicketSummary {
  id: string;
  ticketNumber: string;
  type: WeighbridgeTicketType;
  vehiclePlate?: string | null;
  truckLicensePlate?: string | null;
  supplierOrCustomer?: string | null;
  firstWeightKg: number;
  createdAt: string;
}

export interface WeighbridgeDailyTraffic {
  date: string;
  purchases: number;
  sales: number;
  others: number;
  total: number;
}

export interface WeighbridgeDashboardData {
  kpis: {
    totalMaizeReceivedMt: number;
    totalFlourDispatchedMt: number;
    othersRevenue: number;
    totalTicketsToday: number;
    completedTicketsToday: number;
    pendingTickets: number;
  };
  dailyTraffic: WeighbridgeDailyTraffic[];
  recentTickets: WeighbridgeTicketRecord[];
}

export interface TruckMasterRecord {
  id: string;
  licensePlate: string;
  model: string;
  masterTareKg: number;
  isActive: boolean;
  activeDriver?: string | null;
  createdAt: string;
}

export interface ListResponse<T> {
  tickets: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── ERP lookups (PO / SO) for Header dropdowns ─────────────────────────────

export interface PurchaseOrderLookup {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  supplier?: { id: string; name: string };
  // Heuristic ordered quantity (sum of lines if available)
  orderedQtyKg?: number;
}

export interface SalesOrderLookup {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  customer?: { id: string; name: string };
  itemCount?: number;
}
