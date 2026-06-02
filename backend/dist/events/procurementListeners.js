"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProcurementListeners = registerProcurementListeners;
const eventBus_1 = require("./eventBus");
const procurementEventTypes_1 = require("./procurementEventTypes");
/**
 * Register in-process listeners. External modules (inventory, finance AP)
 * can subscribe to the same event types or poll DomainEvent outbox.
 */
function registerProcurementListeners() {
    (0, eventBus_1.subscribe)(procurementEventTypes_1.PROCUREMENT_EVENTS.GRN_POSTED, async (event) => {
        // eslint-disable-next-line no-console
        console.log("[inventory-hook] GRN posted:", event.payload);
    });
    (0, eventBus_1.subscribe)(procurementEventTypes_1.PROCUREMENT_EVENTS.INVENTORY_RECEIPT, async (event) => {
        // eslint-disable-next-line no-console
        console.log("[inventory-hook] Stock receipt:", event.payload);
    });
    (0, eventBus_1.subscribe)(procurementEventTypes_1.PROCUREMENT_EVENTS.AP_QUEUE_PUSH, async (event) => {
        // eslint-disable-next-line no-console
        console.log("[finance-hook] AP queue:", event.payload);
    });
}
