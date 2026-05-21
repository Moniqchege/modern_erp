import { subscribe } from "./eventBus";
import { PROCUREMENT_EVENTS } from "./procurementEventTypes";

/**
 * Register in-process listeners. External modules (inventory, finance AP)
 * can subscribe to the same event types or poll DomainEvent outbox.
 */
export function registerProcurementListeners(): void {
  subscribe(PROCUREMENT_EVENTS.GRN_POSTED, async (event) => {
    // eslint-disable-next-line no-console
    console.log("[inventory-hook] GRN posted:", event.payload);
  });

  subscribe(PROCUREMENT_EVENTS.INVENTORY_RECEIPT, async (event) => {
    // eslint-disable-next-line no-console
    console.log("[inventory-hook] Stock receipt:", event.payload);
  });

  subscribe(PROCUREMENT_EVENTS.AP_QUEUE_PUSH, async (event) => {
    // eslint-disable-next-line no-console
    console.log("[finance-hook] AP queue:", event.payload);
  });
}
