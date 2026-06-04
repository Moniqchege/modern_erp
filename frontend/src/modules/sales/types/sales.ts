export type CustomerType = "DISTRIBUTOR" | "WHOLESALER" | "RETAILER" | "WALK_IN";
export type CustomerAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "FULFILLED";
export type SalesDispatchStatus = "PENDING" | "LOADING" | "DISPATCHED" | "DELIVERED";
export type SalesOrderPaymentStatus = "PENDING" | "PARTIAL" | "PAID";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIAL" | "PAID" | "VOID" | "OVERDUE";
export type DispatchStatus = "PENDING" | "LOADED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
export type PaymentMethod = "MPESA" | "BANK" | "CASH" | "CHEQUE";

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: CustomerType;
  creditLimit: number;
  currentBalance: number;
  creditDays: number;
  taxPin: string | null;
  status: CustomerAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SalesProduct {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  basePrice: number;
  unit: string;
  category: string;
  isActive: boolean;
}

export interface SalesOrderLine {
  id: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  salesProduct?: SalesProduct | null;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customer?: Customer;
  orderDate: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: SalesOrderPaymentStatus;
  orderStatus: SalesOrderStatus;
  dispatchStatus: SalesDispatchStatus;
  items: SalesOrderLine[];
  invoice?: { id: string; invoiceNumber: string; status: InvoiceStatus } | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  amountDue: number;
  status: InvoiceStatus;
  customerId: string;
  customer?: Customer;
  salesOrderId?: string | null;
  salesOrder?: SalesOrder | null;
  dueDate: string | null;
  issuedAt: string | null;
  createdAt: string;
  payments?: CustomerPayment[];
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  invoiceId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  transactionReference: string | null;
  paidAt: string;
  customer?: { id: string; name: string };
  invoice?: {
    id: string;
    invoiceNumber: string;
    total: number;
    amountDue: number;
    status: InvoiceStatus;
  };
}

export interface DispatchLog {
  id: string;
  dispatchNumber: string;
  customerId: string;
  customer?: Customer;
  invoiceId?: string | null;
  invoice?: { id: string; invoiceNumber: string } | null;
  truckRegistration: string;
  driverName: string;
  driverPhone: string | null;
  status: DispatchStatus;
  loadedAt: string | null;
  deliveredAt: string | null;
  deliveryAddress: string;
  remarks: string | null;
  items: Array<{
    id: string;
    quantity: number;
    pallet?: { id: string; palletBarcode: string };
  }>;
  createdAt: string;
}

export interface SalesDashboard {
  kpis: {
    customerCount: number;
    activeCustomers: number;
    orderCount: number;
    pendingDispatchOrders: number;
    openInvoices: number;
    overdueInvoices: number;
    totalPaymentsKes: number;
    pendingDispatches: number;
    inTransitDispatches: number;
    deliveredDispatches: number;
    creditExposureKes: number;
  };
  ordersByStatus: Record<string, number>;
  dispatchesByStatus: Record<string, number>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    orderStatus: SalesOrderStatus;
    dispatchStatus: SalesDispatchStatus;
    paymentStatus: SalesOrderPaymentStatus;
    totalAmount: number;
    customerName: string;
    orderDate: string;
  }>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    total: number;
    amountDue: number;
    customerName: string;
    createdAt: string;
  }>;
}
