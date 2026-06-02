import type { ErrorRequestHandler } from "express";
import { HttpError } from "../errors/http-error";

export const globalErrorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  _next
) => {
  if (err instanceof HttpError) {
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
