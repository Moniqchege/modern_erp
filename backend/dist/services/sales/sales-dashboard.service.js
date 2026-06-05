"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesDashboard = getSalesDashboard;
const server_1 = require("../../server");
async function getSalesDashboard() {
    const [customerCount, activeCustomers, orderCount, pendingDispatchOrders, openInvoices, overdueInvoices, totalPaymentsAgg, pendingDispatches, inTransitDispatches, deliveredDispatches, recentOrders, recentInvoices,] = await Promise.all([
        server_1.prisma.customer.count(),
        server_1.prisma.customer.count({ where: { status: "ACTIVE" } }),
        server_1.prisma.salesOrder.count(),
        server_1.prisma.salesOrder.count({
            where: {
                orderStatus: { in: ["CONFIRMED"] },
                dispatchStatus: { in: ["PENDING", "LOADING"] },
            },
        }),
        server_1.prisma.invoice.count({
            where: { status: { in: ["ISSUED", "PARTIAL"] } },
        }),
        server_1.prisma.invoice.count({ where: { status: "OVERDUE" } }),
        server_1.prisma.customerPayment.aggregate({ _sum: { amountPaid: true } }),
        server_1.prisma.dispatchLog.count({ where: { status: "PENDING" } }),
        server_1.prisma.dispatchLog.count({ where: { status: "IN_TRANSIT" } }),
        server_1.prisma.dispatchLog.count({ where: { status: "DELIVERED" } }),
        server_1.prisma.salesOrder.findMany({
            take: 8,
            orderBy: { orderDate: "desc" },
            include: { customer: { select: { id: true, name: true } } },
        }),
        server_1.prisma.invoice.findMany({
            take: 8,
            orderBy: { createdAt: "desc" },
            include: { customer: { select: { id: true, name: true } } },
        }),
    ]);
    const ordersByStatus = await server_1.prisma.salesOrder.groupBy({
        by: ["orderStatus"],
        _count: { _all: true },
    });
    const dispatchesByStatus = await server_1.prisma.dispatchLog.groupBy({
        by: ["status"],
        _count: { _all: true },
    });
    const creditExposure = await server_1.prisma.customer.aggregate({
        _sum: { currentBalance: true },
    });
    return {
        kpis: {
            customerCount,
            activeCustomers,
            orderCount,
            pendingDispatchOrders,
            openInvoices,
            overdueInvoices,
            totalPaymentsKes: Number(totalPaymentsAgg._sum.amountPaid ?? 0),
            pendingDispatches,
            inTransitDispatches,
            deliveredDispatches,
            creditExposureKes: Number(creditExposure._sum.currentBalance ?? 0),
        },
        ordersByStatus: Object.fromEntries(ordersByStatus.map((r) => [r.orderStatus, r._count._all])),
        dispatchesByStatus: Object.fromEntries(dispatchesByStatus.map((r) => [r.status, r._count._all])),
        recentOrders: recentOrders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            orderStatus: o.orderStatus,
            dispatchStatus: o.dispatchStatus,
            paymentStatus: o.paymentStatus,
            totalAmount: Number(o.totalAmount),
            customerName: o.customer.name,
            orderDate: o.orderDate,
        })),
        recentInvoices: recentInvoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            total: Number(inv.total),
            amountDue: Number(inv.amountDue),
            customerName: inv.customer.name,
            createdAt: inv.createdAt,
        })),
    };
}
