# TODO - Configurable milling/packaging grades & analytics

## Plan (approved in principle by current task spec; implement next)
- [ ] Step A: Update database schema (Prisma) to store configurable inputs/outputs for packaging and milling keyed by finished_product name.
- [ ] Step B: Add new Prisma models for PackagingRunConfig (finishedProductName, flourConsumedKg, balesProducedKg, mapping to inventory items).
- [ ] Step C: Implement migration SQL via Prisma migration.
- [ ] Step D: Update packaging.service.ts to persist dynamic flourPackedOutputs/consumption into new tables instead of (or in addition to) legacy grade1/grade2 columns.
- [ ] Step E: Update packaging.controller response and list endpoint to return new per-finished-product breakdown plus totals.
- [ ] Step F: Update dashboard analytics to remove hardcoded grade1/grade2 KPIs and instead compute by finished product breakdown.
- [ ] Step G: Update packaging report export (packaging-runs) to use new breakdown.
- [ ] Step H: Update frontend PackagingForm and Dashboard pages to reflect new response fields (per finished product breakdown).
- [ ] Step I: Run tests/build + run Prisma migrate to verify.

## Progress markers
- [ ] Phase 0: Codebase reconnaissance complete.


