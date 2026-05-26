# TODO - StoreInventoryBalance upsert for inventory adjustments

- [ ] Update `backend/src/routes/inventory.ts` so inventory-router quantity create/patch operations also:
  - [ ] Accept a configurable `storeCode` (default `MAIN_STORE`) for where the catalog quantity is applied
  - [ ] Resolve `locationId` via `getLocationIdByCode(storeCode)`
  - [ ] Upsert/update `StoreInventoryBalance` using existing `adjustStoreBalance` helper (physicalDelta)
  - [ ] Create `InventoryMovement` with the resolved `locationId`
- [ ] Ensure the changes are applied within a Prisma transaction so item update + movement + balance update are atomic.
- [ ] Run `npm test`/`npm run build` (or `npm run dev` smoke check) to ensure TypeScript compiles.

