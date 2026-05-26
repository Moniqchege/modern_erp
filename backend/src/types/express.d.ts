import type { Request, Response } from "express";
import { AccessTokenPayload } from "../middleware/auth";

declare module "express" {
    export type TypedRequest<TBody> = Request<unknown, unknown, TBody>;
    export type TypedResponse<TBody> = Response<TBody>;

    declare global {
        namespace Express {
            interface Request {
                auth: AccessTokenPayload;
            }
        }
    }
}

