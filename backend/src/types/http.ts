import type { Request, Response } from "express";

export type TypedRequest<TBody> = Request<any, any, TBody>;
export type TypedResponse<TBody> = Response<TBody>;