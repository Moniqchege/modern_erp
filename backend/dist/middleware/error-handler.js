"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const http_error_1 = require("../errors/http-error");
const globalErrorHandler = (err, _req, res, _next) => {
    if (err instanceof http_error_1.HttpError) {
        return res.status(err.statusCode).json({
            message: err.message,
            code: err.code,
        });
    }
    // eslint-disable-next-line no-console
    console.error("[error]", err);
    return res.status(500).json({
        message: "Internal server error",
        code: "INTERNAL_ERROR",
    });
};
exports.globalErrorHandler = globalErrorHandler;
