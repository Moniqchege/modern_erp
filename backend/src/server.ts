import { PrismaClient } from "@prisma/client";

import { app } from "./app";
import { registerProcurementListeners } from "./events/procurementListeners";
import { ensureDefaultStores } from "./services/store-seed.service";
import { seedDefaultUserIfNeeded } from "./services/auth.service";

export const prisma = new PrismaClient();

registerProcurementListeners();

void (async () => {
  try {
    await seedDefaultUserIfNeeded();
    await ensureDefaultStores();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[startup] store/user seed skipped:", err);
  }
})();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ERP backend listening on port ${PORT}`);
});


