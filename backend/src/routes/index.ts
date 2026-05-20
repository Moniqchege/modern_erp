import { Router } from "express";

import { inventoryRouter } from "./inventory";
import { customersRouter } from "./customers";
import { invoicesRouter } from "./invoices";
import { productionRouter } from "./production";
import { dashboardRouter } from "./dashboard";

export const routes = Router();

routes.use("/inventory", inventoryRouter);
routes.use("/customers", customersRouter);
routes.use("/invoices", invoicesRouter);
routes.use("/production", productionRouter);
routes.use("/dashboard", dashboardRouter);








