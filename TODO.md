# TODO - ERP-grade inventory (stock movements + price history)

## Step 1 (DB): Price history + inventory ledger
- [ ] Update `backend/prisma/schema.prisma`
  - Add `InventoryPriceHistory`
  - Add `InventoryMovement` (movementType, qty delta, movementAt, unitPriceApplied, optional refs)

## Step 2 (DB): Migrate + regen Prisma client
- [ ] Create and apply Prisma migration
- [ ] `prisma generate`

## Step 3 (Backend): Inventory APIs
- [ ] Update `backend/src/routes/inventory.ts`
  - Add Edit Item endpoint
  - Add Price History endpoint
  - Add stock movement endpoints (receipt / issue / adjustment / sales dispatch)
- [ ] Ensure SKU uniqueness rule remains enforced

## Step 4 (Backend): Inventory response shape
- [ ] Update GET /api/inventory to include current effective unit price (latest PriceHistory)
- [ ] Ensure quantity updates are driven by movements

## Step 5 (Frontend): Edit Item UI + price history UI
- [ ] Update `frontend/src/pages/Inventory.tsx`
  - Add Edit Item button + modal
  - Add price history update UI (effective date)

## Step 6 (Frontend): Stock movement UI (MVP)
- [ ] Add movement modal/actions from Inventory page
  - Receive / Issue to production / Adjustment / Sales dispatch

## Step 7: Testing
- [ ] Smoke test: create SKU, edit item, add price history with different dates
- [ ] Smoke test: apply multiple movements and verify quantities and ledger rows

