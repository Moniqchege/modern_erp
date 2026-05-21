"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishDomainEvent = publishDomainEvent;
exports.subscribe = subscribe;
exports.getEventEmitter = getEventEmitter;
const events_1 = require("events");
const server_1 = require("../server");
const emitter = new events_1.EventEmitter();
emitter.setMaxListeners(50);
/**
 * In-process pub/sub (Kafka/EventBridge style hook surface).
 * Persists to DomainEvent outbox for retry / external consumers.
 */
async function publishDomainEvent(event) {
    const record = await server_1.prisma.domainEvent.create({
        data: {
            eventType: event.eventType,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payload: event.payload,
        },
    });
    try {
        emitter.emit(event.eventType, { ...event, outboxId: record.id });
        await server_1.prisma.domainEvent.update({
            where: { id: record.id },
            data: { status: "PUBLISHED", publishedAt: new Date() },
        });
    }
    catch (err) {
        await server_1.prisma.domainEvent.update({
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
function subscribe(eventType, handler) {
    emitter.on(eventType, (data) => {
        void Promise.resolve(handler(data)).catch((err) => {
            // eslint-disable-next-line no-console
            console.error(`[eventBus] handler failed for ${eventType}:`, err);
        });
    });
}
function getEventEmitter() {
    return emitter;
}
