import { EventEmitter } from "events";
import { prisma } from "../server";
import type { ProcurementEventType } from "./procurementEventTypes";

export interface DomainEventPayload {
  eventType: ProcurementEventType | string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

/**
 * In-process pub/sub (Kafka/EventBridge style hook surface).
 * Persists to DomainEvent outbox for retry / external consumers.
 */
export async function publishDomainEvent(event: DomainEventPayload): Promise<void> {
  const record = await prisma.domainEvent.create({
    data: {
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
    },
  });

  try {
    emitter.emit(event.eventType, { ...event, outboxId: record.id });
    await prisma.domainEvent.update({
      where: { id: record.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  } catch (err) {
    await prisma.domainEvent.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        retryCount: { increment: 1 },
        lastError: String(err),
      },
    });
    throw err;
  }
}

export function subscribe(
  eventType: string,
  handler: (event: DomainEventPayload & { outboxId: string }) => void | Promise<void>
): void {
  emitter.on(eventType, (data) => {
    void Promise.resolve(handler(data)).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[eventBus] handler failed for ${eventType}:`, err);
    });
  });
}

export function getEventEmitter(): EventEmitter {
  return emitter;
}
