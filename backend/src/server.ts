import { PrismaClient } from "@prisma/client";

import { app } from "./app";
import { registerProcurementListeners } from "./events/procurementListeners";

export const prisma = new PrismaClient();

registerProcurementListeners();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ERP backend listening on port ${PORT}`);
});


