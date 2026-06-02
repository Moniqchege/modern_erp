"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDefaultStores = ensureDefaultStores;
exports.getLocationIdByCode = getLocationIdByCode;
const server_1 = require("../server");
const DEFAULT_STORES = [
    { code: "MAIN_STORE", name: "Main Store" },
    { code: "PACKAGING_STORE", name: "Packaging Store (Production)" },
    { code: "MAIZE_STORE", name: "Maize Store (Milling)" },
    { code: "DISPATCH_STORE", name: "Dispatch Store" },
];
async function ensureDefaultStores() {
    for (const store of DEFAULT_STORES) {
        await server_1.prisma.inventoryLocation.upsert({
            where: { code: store.code },
            update: { name: store.name },
            create: { code: store.code, name: store.name },
        });
    }
}
async function getLocationIdByCode(code) {
    const loc = await server_1.prisma.inventoryLocation.findUnique({ where: { code } });
    if (!loc)
        throw new Error(`Store not found: ${code}`);
    return loc.id;
}
