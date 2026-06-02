"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.BadRequestError = exports.NotFoundError = exports.HttpError = void 0;
class HttpError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, code) {
        super(message);
        this.name = "HttpError";
        this.statusCode = statusCode;
        this.code = code;
    }
}
exports.HttpError = HttpError;
class NotFoundError extends HttpError {
    constructor(message, code = "NOT_FOUND") {
        super(404, message, code);
        this.name = "NotFoundError";
    }
}
exports.NotFoundError = NotFoundError;
class BadRequestError extends HttpError {
    constructor(message, code = "BAD_REQUEST") {
        super(400, message, code);
        this.name = "BadRequestError";
    }
}
exports.BadRequestError = BadRequestError;
class ConflictError extends HttpError {
    constructor(message, code = "CONFLICT") {
        super(409, message, code);
        this.name = "ConflictError";
    }
}
exports.ConflictError = ConflictError;
