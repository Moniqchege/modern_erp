export class HttpError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string, code = "NOT_FOUND") {
    super(404, message, code);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string, code = "BAD_REQUEST") {
    super(400, message, code);
    this.name = "BadRequestError";
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, code = "CONFLICT") {
    super(409, message, code);
    this.name = "ConflictError";
  }
}
