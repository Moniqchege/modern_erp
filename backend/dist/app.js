"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("./routes");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json({ limit: "1mb" }));
exports.app.get("/health", (_req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.status(200).json({ ok: true });
});
exports.app.use("/api", routes_1.routes);
