import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { WeighbridgeService } from "../services/weighbridge.service";
import { WeighbridgeController } from "../controllers/weighbridge.controller";
import { requireAuth } from "../middleware/auth";
import type {
  WeighbridgeTicketType,
  WeighbridgeTicketStatus,
} from "../types/weighbridge";

const prisma = new PrismaClient();
const service = new WeighbridgeService(prisma);
const controller = new WeighbridgeController(service);

export const weighbridgeRouter = Router();

// Re-export the local enum types so consumers can import them from this module
export type { WeighbridgeTicketType, WeighbridgeTicketStatus };

// All endpoints require authentication
weighbridgeRouter.use(requireAuth);

// ─── Tickets ────────────────────────────────────────────────────────────────

/** GET /api/weighbridge/tickets
 *  Optional query: status, type, vehiclePlate, dateFrom, dateTo, isManual, page, limit
 */
weighbridgeRouter.get("/tickets", controller.listTickets);

/** GET /api/weighbridge/tickets/pending — right-pane queue */
weighbridgeRouter.get("/tickets/pending", controller.listPendingTickets);

/** GET /api/weighbridge/tickets/:id */
weighbridgeRouter.get("/tickets/:id", controller.getTicketById);

/** POST /api/weighbridge/tickets/purchase — Create purchase (Step 1) */
weighbridgeRouter.post("/tickets/purchase", controller.createPurchaseTicket);

/** POST /api/weighbridge/tickets/sale — Create sale (Step 1) */
weighbridgeRouter.post("/tickets/sale", controller.createSaleTicket);

/** POST /api/weighbridge/tickets/others — Create others (Step 1) */
weighbridgeRouter.post("/tickets/others", controller.createOthersTicket);

/** POST /api/weighbridge/tickets/:id/second-weight — Capture second weight (Step 2) */
weighbridgeRouter.post(
  "/tickets/:id/second-weight",
  controller.captureSecondWeight
);

/** POST /api/weighbridge/tickets/:id/complete-others — Step 2 with payment */
weighbridgeRouter.post(
  "/tickets/:id/complete-others",
  controller.completeOthersTicket
);

/** POST /api/weighbridge/tickets/:id/cancel */
weighbridgeRouter.post("/tickets/:id/cancel", controller.cancelTicket);

// ─── Dashboard ──────────────────────────────────────────────────────────────

/** GET /api/weighbridge/dashboard?dateFrom=&dateTo= */
weighbridgeRouter.get("/dashboard", controller.getDashboard);

// ─── Truck master ───────────────────────────────────────────────────────────

/** GET /api/weighbridge/trucks */
weighbridgeRouter.get("/trucks", controller.listTrucks);

/** POST /api/weighbridge/trucks/:id/assign-driver */
weighbridgeRouter.post(
  "/trucks/:id/assign-driver",
  controller.assignDriver
);
