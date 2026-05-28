import { Router } from "express";
import {
  listPackagingRuns,
  processPackaging,
  getKgPerUnitMap,
} from "../controllers/packaging";

export const packagingRouter = Router();

packagingRouter.get("/", listPackagingRuns);
packagingRouter.post("/", processPackaging);
packagingRouter.get("/kg-per-unit", getKgPerUnitMap);