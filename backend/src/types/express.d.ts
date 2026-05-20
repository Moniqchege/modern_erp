import type { Request, Response } from "express";

declare module "express" {
    // Keep this for future augmentations.
    export type TypedRequest<TBody> = Request<unknown, unknown, TBody>;
    export type TypedResponse<TBody> = Response<TBody>;
}

