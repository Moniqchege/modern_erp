import { StoreCode } from "@prisma/client";
import { prisma } from "../server";

const DEFAULT_STORES: Array<{ code: StoreCode; name: string }> = [
  { code: "MAIN_STORE", name: "Main Store" },
  { code: "PACKAGING_STORE", name: "Packaging Store (Production)" },
  { code: "MAIZE_STORE", name: "Maize Store (Milling)" },
  { code: "DISPATCH_STORE", name: "Dispatch Store" },
];

export async function ensureDefaultStores() {
  for (const store of DEFAULT_STORES) {
    await prisma.inventoryLocation.upsert({
      where: { code: store.code },
      update: { name: store.name },
      create: { code: store.code, name: store.name },
    });
  }
}

export async function getLocationIdByCode(code: StoreCode) {
  const loc = await prisma.inventoryLocation.findUnique({ where: { code } });
  if (!loc) throw new Error(`Store not found: ${code}`);
  return loc.id;
}
