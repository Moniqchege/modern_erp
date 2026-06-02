import { publishDomainEvent } from "../../events/eventBus";
import { SALES_EVENTS } from "../../events/salesEventTypes";

export type ReservationLine = {
  productSku: string;
  quantity: number;
};

/**
 * Notifies the Inventory Module to reserve stock (outbox + in-process event).
 * Replace the listener with a real inventory adapter when integrated.
 */
export async function updateInventoryReservation(
  orderId: string,
  items: ReservationLine[]
): Promise<void> {
  await publishDomainEvent({
    eventType: SALES_EVENTS.INVENTORY_RESERVE_REQUESTED,
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
  console.info(
    `[sales] inventory reservation placeholder for order ${orderId}:`,
    items.map((i) => `${i.productSku} x ${i.quantity}`).join(", ")
  );
}
