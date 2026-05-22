import { Router } from "express";
import { listPackagingRuns, processPackaging } from "../controllers/packaging";

export const packagingRouter = Router();

packagingRouter.get("/", listPackagingRuns);
packagingRouter.post("/", processPackaging);
