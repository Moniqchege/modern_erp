"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInventoryReservation = updateInventoryReservation;
const eventBus_1 = require("../../events/eventBus");
const salesEventTypes_1 = require("../../events/salesEventTypes");
/**
 * Notifies the Inventory Module to reserve stock (outbox + in-process event).
 * Replace the listener with a real inventory adapter when integrated.
 */
async function updateInventoryReservation(orderId, items) {
    await (0, eventBus_1.publishDomainEvent)({
        eventType: salesEventTypes_1.SALES_EVENTS.INVENTORY_RESERVE_REQUESTED,
        aggregateType: "SalesOrder",
        aggregateId: orderId,
        payload: {
            orderId,
            items,
            reservedAt: new Date().toISOString(),
            module: "inventory",
            action: "RESERVE_STOCK",
        },
    });
    // eslint-disable-next-line no-console
    console.info(`[sales] inventory reservation placeholder for order ${orderId}:`, items.map((i) => `${i.productSku} x ${i.quantity}`).join(", "));
}
