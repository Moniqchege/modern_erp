// backend/src/modules/weighbridge/weighbridge.service.ts

import { PrismaClient, WeighbridgeTicketType, WeighbridgeTicketStatus } from '@prisma/client';
import type {
  CreatePurchaseTicketDto,
  CreateSaleTicketDto,
  CreateOthersTicketDto,
  CaptureSecondWeightDto,
  CompleteOthersTicketDto,
  CancelTicketDto,
  WeighbridgeTicketFilters,
  WeighbridgeDashboardQuery,
  WeighbridgeTicketRecord,
  PendingTicketSummary,
  WeighbridgeDashboardData,
  TruckMasterRecord,
} from '../types/weighbridge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTicketNumber(prefix: string): string {
  const ts = Date.now().toString().slice(-7);
  return `WBT-${prefix}-${ts}`;
}

/**
 * Net weight calculation depends on transaction direction.
 *
 *  PURCHASE / OTHERS → vehicle arrives heavy, leaves empty
 *    Net = firstWeight (gross) − secondWeight (tare)
 *
 *  SALE → vehicle arrives empty (tare), leaves loaded (gross)
 *    Net = secondWeight (gross) − firstWeight (tare)
 */
function calculateNetWeight(
  type: WeighbridgeTicketType,
  firstWeightKg: number,
  secondWeightKg: number,
): number {
  if (type === WeighbridgeTicketType.SALE) {
    return secondWeightKg - firstWeightKg;
  }
  return firstWeightKg - secondWeightKg;
}

function toDecimalSafe(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function serializeTicket(t: any): WeighbridgeTicketRecord {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    type: t.type as WeighbridgeTicketType,
    status: t.status as WeighbridgeTicketStatus,
    purchaseOrderId: t.purchaseOrderId ?? null,
    supplierName: t.supplierName ?? null,
    supplierDriverName: t.supplierDriverName ?? null,
    salesOrderId: t.salesOrderId ?? null,
    customerName: t.customerName ?? null,
    truckMasterId: t.truckMasterId ?? null,
    assignedDriverName: t.assignedDriverName ?? null,
    vehiclePlate: t.vehiclePlate ?? null,
    driverName: t.driverName ?? null,
    firstWeightKg: toDecimalSafe(t.firstWeightKg),
    firstWeightAt: t.firstWeightAt?.toISOString() ?? null,
    secondWeightKg: toDecimalSafe(t.secondWeightKg),
    secondWeightAt: t.secondWeightAt?.toISOString() ?? null,
    netWeightKg: toDecimalSafe(t.netWeightKg),
    tareVarianceKg: toDecimalSafe(t.tareVarianceKg),
    varianceFlagged: t.varianceFlagged ?? false,
    isManual: t.isManual ?? false,
    serviceDescription: t.serviceDescription ?? null,
    paymentMethod: t.paymentMethod ?? null,
    amountCharged: toDecimalSafe(t.amountCharged),
    receiptReference: t.receiptReference ?? null,
    cancellationReason: t.cancellationReason ?? null,
    cancelledAt: t.cancelledAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    operatorName: t.operatorName ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    purchaseOrder: t.purchaseOrder
      ? {
          poNumber: t.purchaseOrder.poNumber,
          supplier: t.purchaseOrder.supplier
            ? { name: t.purchaseOrder.supplier.name }
            : undefined,
        }
      : null,
    salesOrder: t.salesOrder
      ? {
          orderNumber: t.salesOrder.orderNumber,
          customer: t.salesOrder.customer
            ? { name: t.salesOrder.customer.name }
            : undefined,
        }
      : null,
    truckMaster: t.truckMaster
      ? {
          licensePlate: t.truckMaster.licensePlate,
          model: t.truckMaster.model,
          masterTareKg: Number(t.truckMaster.masterTareKg),
        }
      : null,
  };
}

const TICKET_INCLUDE = {
  purchaseOrder: { include: { supplier: { select: { name: true } } } },
  salesOrder: { include: { customer: { select: { name: true } } } },
  truckMaster: { select: { licensePlate: true, model: true, masterTareKg: true } },
} as const;

// ─── WeighbridgeService ───────────────────────────────────────────────────────

export class WeighbridgeService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Ticket creation ─────────────────────────────────────────────────────────

  async createPurchaseTicket(dto: CreatePurchaseTicketDto): Promise<WeighbridgeTicketRecord> {
    const ticket = await this.prisma.weighbridgeTicket.create({
      data: {
        ticketNumber: generateTicketNumber('PUR'),
        type: WeighbridgeTicketType.PURCHASE,
        status: WeighbridgeTicketStatus.PENDING,
        purchaseOrderId: dto.purchaseOrderId ?? null,
        supplierName: dto.supplierName,
        supplierDriverName: dto.supplierDriverName ?? null,
        vehiclePlate: dto.vehiclePlate.toUpperCase().trim(),
        driverName: dto.driverName,
        firstWeightKg: dto.firstWeightKg,
        firstWeightAt: new Date(),
        isManual: dto.isManual ?? false,
        operatorName: dto.operatorName ?? null,
      },
      include: TICKET_INCLUDE,
    });
    return serializeTicket(ticket);
  }

  async createSaleTicket(dto: CreateSaleTicketDto): Promise<WeighbridgeTicketRecord> {
    // Fetch truck to snapshot driver and check variance
    const truck = await this.prisma.weighbridgeTruckMaster.findUnique({
      where: { id: dto.truckMasterId },
      include: {
        driverAssignments: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!truck) {
      throw new Error(`Truck ${dto.truckMasterId} not found`);
    }

    const activeDriver = truck.driverAssignments[0]?.driverName ?? null;
    const masterTare = Number(truck.masterTareKg);
    const variance = Math.abs(dto.firstWeightKg - masterTare);
    const varianceFlagged = variance > Number(50); // configurable threshold

    const ticket = await this.prisma.weighbridgeTicket.create({
      data: {
        ticketNumber: generateTicketNumber('SAL'),
        type: WeighbridgeTicketType.SALE,
        status: WeighbridgeTicketStatus.PENDING,
        salesOrderId: dto.salesOrderId ?? null,
        customerName: dto.customerName,
        truckMasterId: dto.truckMasterId,
        assignedDriverName: activeDriver, // audit snapshot
        firstWeightKg: dto.firstWeightKg,
        firstWeightAt: new Date(),
        tareVarianceKg: variance,
        varianceFlagged,
        isManual: dto.isManual ?? false,
        operatorName: dto.operatorName ?? null,
      },
      include: TICKET_INCLUDE,
    });
    return serializeTicket(ticket);
  }

  async createOthersTicket(dto: CreateOthersTicketDto): Promise<WeighbridgeTicketRecord> {
    const ticket = await this.prisma.weighbridgeTicket.create({
      data: {
        ticketNumber: generateTicketNumber('OTH'),
        type: WeighbridgeTicketType.OTHERS,
        status: WeighbridgeTicketStatus.PENDING,
        customerName: dto.customerName,
        vehiclePlate: dto.vehiclePlate.toUpperCase().trim(),
        driverName: dto.driverName,
        serviceDescription: dto.serviceDescription,
        firstWeightKg: dto.firstWeightKg,
        firstWeightAt: new Date(),
        isManual: dto.isManual ?? false,
        operatorName: dto.operatorName ?? null,
      },
      include: TICKET_INCLUDE,
    });
    return serializeTicket(ticket);
  }

  // ── Weight capture ──────────────────────────────────────────────────────────

  async captureSecondWeight(
    ticketId: string,
    dto: CaptureSecondWeightDto,
  ): Promise<WeighbridgeTicketRecord> {
    const existing = await this.prisma.weighbridgeTicket.findUnique({
      where: { id: ticketId },
    });

    if (!existing) throw new Error(`Ticket ${ticketId} not found`);
    if (existing.status !== WeighbridgeTicketStatus.PENDING) {
      throw new Error(`Ticket ${ticketId} is not in PENDING status`);
    }
    if (!existing.firstWeightKg) {
      throw new Error(`Ticket ${ticketId} has no first weight recorded`);
    }

    const netWeightKg = calculateNetWeight(
      existing.type as WeighbridgeTicketType,
      Number(existing.firstWeightKg),
      dto.secondWeightKg,
    );

    if (netWeightKg < 0) {
      throw new Error(
        `Net weight is negative (${netWeightKg} kg). Check weight entry order for ${existing.type} transactions.`,
      );
    }

    const ticket = await this.prisma.weighbridgeTicket.update({
      where: { id: ticketId },
      data: {
        secondWeightKg: dto.secondWeightKg,
        secondWeightAt: new Date(),
        netWeightKg,
        status: WeighbridgeTicketStatus.COMPLETED,
        completedAt: new Date(),
        isManual: dto.isManual ?? existing.isManual,
      },
      include: TICKET_INCLUDE,
    });
    return serializeTicket(ticket);
  }

  async completeOthersTicket(
    ticketId: string,
    dto: CompleteOthersTicketDto,
  ): Promise<WeighbridgeTicketRecord> {
    const existing = await this.prisma.weighbridgeTicket.findUnique({
      where: { id: ticketId },
    });

    if (!existing) throw new Error(`Ticket ${ticketId} not found`);
    if (existing.type !== WeighbridgeTicketType.OTHERS) {
      throw new Error(`Ticket ${ticketId} is not an OTHERS ticket`);
    }
    if (existing.status !== WeighbridgeTicketStatus.PENDING) {
      throw new Error(`Ticket ${ticketId} is not in PENDING status`);
    }
    if (!existing.firstWeightKg) {
      throw new Error(`Ticket ${ticketId} has no first weight recorded`);
    }

    const netWeightKg = calculateNetWeight(
      WeighbridgeTicketType.OTHERS,
      Number(existing.firstWeightKg),
      dto.secondWeightKg,
    );

    if (netWeightKg < 0) {
      throw new Error(`Net weight is negative (${netWeightKg} kg).`);
    }

    const ticket = await this.prisma.weighbridgeTicket.update({
      where: { id: ticketId },
      data: {
        secondWeightKg: dto.secondWeightKg,
        secondWeightAt: new Date(),
        netWeightKg,
        status: WeighbridgeTicketStatus.COMPLETED,
        completedAt: new Date(),
        paymentMethod: dto.paymentMethod,
        amountCharged: dto.amountCharged,
        receiptReference: dto.receiptReference ?? null,
        isManual: dto.isManual ?? existing.isManual,
      },
      include: TICKET_INCLUDE,
    });
    return serializeTicket(ticket);
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────

  async cancelTicket(ticketId: string, dto: CancelTicketDto): Promise<WeighbridgeTicketRecord> {
    const existing = await this.prisma.weighbridgeTicket.findUnique({
      where: { id: ticketId },
    });
    if (!existing) throw new Error(`Ticket ${ticketId} not found`);
    if (existing.status === WeighbridgeTicketStatus.COMPLETED) {
      throw new Error(`Completed tickets cannot be cancelled`);
    }

    const ticket = await this.prisma.weighbridgeTicket.update({
      where: { id: ticketId },
      data: {
        status: WeighbridgeTicketStatus.CANCELLED,
        cancellationReason: dto.reason,
        cancelledByUserId: dto.cancelledByUserId ?? null,
        cancelledAt: new Date(),
      },
      include: TICKET_INCLUDE,
    });
    return serializeTicket(ticket);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async getTicketById(ticketId: string): Promise<WeighbridgeTicketRecord> {
    const ticket = await this.prisma.weighbridgeTicket.findUnique({
      where: { id: ticketId },
      include: TICKET_INCLUDE,
    });
    if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
    return serializeTicket(ticket);
  }

  async listTickets(
    filters: WeighbridgeTicketFilters,
  ): Promise<{ tickets: WeighbridgeTicketRecord[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }
    if (filters.type) {
      where.type = Array.isArray(filters.type)
        ? { in: filters.type }
        : filters.type;
    }
    if (filters.vehiclePlate) {
      where.vehiclePlate = { contains: filters.vehiclePlate.toUpperCase() };
    }
    if (filters.isManual !== undefined) {
      where.isManual = filters.isManual;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [tickets, total] = await Promise.all([
      this.prisma.weighbridgeTicket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.weighbridgeTicket.count({ where }),
    ]);

    return { tickets: tickets.map(serializeTicket), total, page, limit };
  }

  /** Returns only PENDING tickets — feeds the right-pane queue */
  async listPendingTickets(): Promise<PendingTicketSummary[]> {
    const tickets = await this.prisma.weighbridgeTicket.findMany({
      where: { status: WeighbridgeTicketStatus.PENDING },
      include: {
        truckMaster: { select: { licensePlate: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      type: t.type as WeighbridgeTicketType,
      vehiclePlate: t.vehiclePlate ?? null,
      truckLicensePlate: t.truckMaster?.licensePlate ?? null,
      supplierOrCustomer: t.supplierName ?? t.customerName ?? null,
      firstWeightKg: Number(t.firstWeightKg),
      createdAt: t.createdAt.toISOString(),
    }));
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────

  async getDashboard(query: WeighbridgeDashboardQuery): Promise<WeighbridgeDashboardData> {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : this._startOfDay(new Date());
    const dateTo = query.dateTo ? new Date(query.dateTo) : this._endOfDay(new Date());

    const todayStart = this._startOfDay(new Date());
    const todayEnd = this._endOfDay(new Date());

    const [
      completedPurchases,
      completedSales,
      othersCompleted,
      pendingCount,
      todayTickets,
      dailyRaw,
      recentRaw,
    ] = await Promise.all([
      // Total maize received (completed PURCHASE tickets)
      this.prisma.weighbridgeTicket.aggregate({
        where: {
          type: WeighbridgeTicketType.PURCHASE,
          status: WeighbridgeTicketStatus.COMPLETED,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: { netWeightKg: true },
      }),
      // Total flour dispatched (completed SALE tickets)
      this.prisma.weighbridgeTicket.aggregate({
        where: {
          type: WeighbridgeTicketType.SALE,
          status: WeighbridgeTicketStatus.COMPLETED,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: { netWeightKg: true },
      }),
      // Others revenue
      this.prisma.weighbridgeTicket.aggregate({
        where: {
          type: WeighbridgeTicketType.OTHERS,
          status: WeighbridgeTicketStatus.COMPLETED,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _sum: { amountCharged: true },
      }),
      // Pending count
      this.prisma.weighbridgeTicket.count({
        where: { status: WeighbridgeTicketStatus.PENDING },
      }),
      // Today tickets breakdown
      this.prisma.weighbridgeTicket.groupBy({
        by: ['status'],
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        _count: { id: true },
      }),
      // Daily traffic for last 14 days
      this.prisma.weighbridgeTicket.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          },
        },
        select: { type: true, createdAt: true },
      }),
      // Recent 20 tickets
      this.prisma.weighbridgeTicket.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: TICKET_INCLUDE,
      }),
    ]);

    // Build daily traffic map
    const trafficMap = new Map<string, { purchases: number; sales: number; others: number }>();
    for (const t of dailyRaw) {
      const key = t.createdAt.toISOString().slice(0, 10);
      if (!trafficMap.has(key)) trafficMap.set(key, { purchases: 0, sales: 0, others: 0 });
      const entry = trafficMap.get(key)!;
      if (t.type === 'PURCHASE') entry.purchases++;
      else if (t.type === 'SALE') entry.sales++;
      else entry.others++;
    }
    const dailyTraffic = Array.from(trafficMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        ...counts,
        total: counts.purchases + counts.sales + counts.others,
      }));

    const totalToday = todayTickets.reduce((s, g) => s + g._count.id, 0);
    const completedToday =
      todayTickets.find((g) => g.status === 'COMPLETED')?._count.id ?? 0;

    return {
      kpis: {
        totalMaizeReceivedMt: Math.round((Number(completedPurchases._sum.netWeightKg) || 0) / 1000 * 100) / 100,
        totalFlourDispatchedMt: Math.round((Number(completedSales._sum.netWeightKg) || 0) / 1000 * 100) / 100,
        othersRevenue: Math.round(Number(othersCompleted._sum.amountCharged) || 0),
        totalTicketsToday: totalToday,
        completedTicketsToday: completedToday,
        pendingTickets: pendingCount,
      },
      dailyTraffic,
      recentTickets: recentRaw.map(serializeTicket),
    };
  }

  // ── Truck master data ────────────────────────────────────────────────────────

  async listTrucks(): Promise<TruckMasterRecord[]> {
    const trucks = await this.prisma.weighbridgeTruckMaster.findMany({
      where: { isActive: true },
      include: {
        driverAssignments: {
          where: { isActive: true },
          take: 1,
        },
      },
      orderBy: { licensePlate: 'asc' },
    });

    return trucks.map((t) => ({
      id: t.id,
      licensePlate: t.licensePlate,
      model: t.model,
      masterTareKg: Number(t.masterTareKg),
      isActive: t.isActive,
      activeDriver: t.driverAssignments[0]?.driverName ?? null,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async assignDriver(truckId: string, driverName: string): Promise<TruckMasterRecord> {
    // Deactivate previous driver
    await this.prisma.weighbridgeTruckDriverAssignment.updateMany({
      where: { truckId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    });

    await this.prisma.weighbridgeTruckDriverAssignment.create({
      data: { truckId, driverName, isActive: true },
    });

    const truck = await this.prisma.weighbridgeTruckMaster.findUnique({
      where: { id: truckId },
      include: {
        driverAssignments: { where: { isActive: true }, take: 1 },
      },
    });

    if (!truck) throw new Error(`Truck ${truckId} not found`);

    return {
      id: truck.id,
      licensePlate: truck.licensePlate,
      model: truck.model,
      masterTareKg: Number(truck.masterTareKg),
      isActive: truck.isActive,
      activeDriver: truck.driverAssignments[0]?.driverName ?? null,
      createdAt: truck.createdAt.toISOString(),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  private _endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }
}