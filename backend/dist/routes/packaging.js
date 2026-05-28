"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packagingRouter = void 0;
const express_1 = require("express");
const packaging_1 = require("../controllers/packaging");
exports.packagingRouter = (0, express_1.Router)();
exports.packagingRouter.get("/", packaging_1.listPackagingRuns);
exports.packagingRouter.post("/", packaging_1.processPackaging);
exports.packagingRouter.get("/kg-per-unit", packaging_1.getKgPerUnitMap);
