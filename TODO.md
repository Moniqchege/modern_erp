# TODO - Unit price buying/selling split

- [ ] Update Prisma schema: introduce `InventoryPriceType` enum and `priceType` column on `InventoryPriceHistory`.
- [ ] Add migration for Prisma schema changes.
- [ ] Update inventory API routes (`backend/src/routes/inventory.ts`):
  - [ ] POST /inventory: store price in `InventoryPriceHistory` with correct `priceType` derived from item.type.
  - [ ] PATCH /inventory/:id: store updated unit price in correct `priceType` stream and return it.
  - [ ] GET /inventory and GET /inventory/:id: return latest `unitPrice` for correct `priceType`.
- [ ] Ensure responses still expose `unitPrice` to frontend (so `frontend/src/pages/inventory/Inventory.tsx` continues working).
- [ ] Run backend tests / sanity checks by calling inventory endpoints.

