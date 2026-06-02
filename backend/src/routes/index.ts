import { Router } from "express";

import { inventoryRouter } from "./inventory";
import { customersRouter } from "./customers";
import { invoicesRouter } from "./invoices";
import { salesOrdersRouter } from "./sales-orders";
import { paymentsRouter } from "./payments";
import { productionRouter } from "./production";
import { packagingRouter } from "./packaging";
import { dashboardRouter } from "./dashboard";
import { authRouter } from "./auth";
import { suppliersRouter } from "./suppliers";
import { procurementRouter } from "./procurement";
import { traceabilityRouter } from "./traceability";
import { stockTransferRouter } from "./stock-transfer";
import { storesRouter } from "./stores";
import { usersRouter } from "./users";

export const routes = Router();

routes.use("/auth", authRouter);
routes.use("/inventory", inventoryRouter);
routes.use("/stores", storesRouter);
routes.use("/users", usersRouter);
routes.use("/customers", customersRouter);
routes.use("/sales-orders", salesOrdersRouter);
routes.use("/invoices", invoicesRouter);
routes.use("/payments", paymentsRouter);
routes.use("/production", productionRouter);
routes.use("/packaging", packagingRouter);
routes.use("/dashboard", dashboardRouter);
routes.use("/suppliers", suppliersRouter);
routes.use("/procurement", procurementRouter);
routes.use("/traceability", traceabilityRouter);
routes.use("/stock-transfers", stockTransferRouter);
















