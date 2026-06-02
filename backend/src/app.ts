import express from "express";
import cors from "cors";

import { routes } from "./routes";
import { globalErrorHandler } from "./middleware/error-handler";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req: unknown, res: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).status(200).json({ ok: true });
});

app.use("/api", routes);
app.use(globalErrorHandler);


