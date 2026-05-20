# Modern ERP - Traceability/Inventory Module TODO

## Plan recap
- Align Prisma schema for invoice linkage needed by forward traceability.
- Upgrade core traceability services:
  - receive_raw_maize() quarantine + movement guards
  - calculate_milling_yield() with explicit moisture loss variance + 3% alert
  - enforce_fifo_picking() robust ordering + quarantine/APPR guard
  - trace_forward() richer tree including invoice and destination
  - trace_backward() ensure exact QC + supplier/truck + run metadata
- Update dispatch service to set invoice linkage and enforce APPROVED-only movement.

## Steps
- [x] Create/Update Prisma schema: add DispatchLog ↔ Invoice relation (invoiceId)

- [x] Add/Update Prisma migration strategy (run migrate)



- [x] Update traceability.service.ts: implement guards + upgrade yield + trace tree



- [ ] Update dispatch.service.ts: set invoiceId, enforce approved upstream raw batches

- [ ] Update routes/controllers if wiring changes are required
- [ ] Run TypeScript build
- [ ] Run a quick endpoint smoke test (receive→QC→production→dispatch→trace)
