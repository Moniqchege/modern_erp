"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const app_1 = require("./app");
const procurementListeners_1 = require("./events/procurementListeners");
const store_seed_service_1 = require("./services/store-seed.service");
const auth_service_1 = require("./services/auth.service");
const sales_seed_service_1 = require("./services/sales-seed.service");
exports.prisma = new client_1.PrismaClient();
(0, procurementListeners_1.registerProcurementListeners)();
void (async () => {
    try {
        await (0, auth_service_1.seedDefaultUserIfNeeded)();
        await (0, store_seed_service_1.ensureDefaultStores)();
        await (0, sales_seed_service_1.seedSalesModuleIfNeeded)();
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[startup] store/user seed skipped:", err);
    }
})();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app_1.app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ERP backend listening on port ${PORT}`);
});
