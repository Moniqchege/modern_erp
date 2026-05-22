# TODO - Flour Types (catalogued FINISHED_GOOD) support

## Backend
- [ ] Update production controller `/api/production` to accept dynamic `flourOutputs` (FINISHED_GOOD) and keep `maizeJamProduced` fixed as `BY-JAM-03`.
- [ ] Update traceability production-run `/api/traceability/production-run` to accept dynamic `flourOutputs` (FINISHED_GOOD) and keep jam as `BY-JAM-03`.
- [ ] Update packaging `/api/packaging` to accept dynamic `flourConsumption` + `flourPackedOutputs` (for each flour type: select bale inventory item + bales qty), while keeping `baleWeightKg` global.
- [ ] Update production/packaging form UIs to render dynamic flour-type fields.

- [ ] Update dashboard KPIs and analytics to remove hardcoded grade1/grade2 and instead aggregate finished goods dynamically.


## Frontend
- [ ] Fetch flour types from inventory (filter `type === FINISHED_GOOD`).
- [ ] Update Production form to render one output quantity input per flour type.
- [ ] Update Packaging form to render:
  - consumedKg per flour type
  - packed output: for each flour type, select/enter bale item (bale inventory item) and balesQty.

## Data / Integration
- [ ] Ensure catalogue includes bale inventory items as `FINISHED_GOOD` (or `BY_PRODUCT` if that’s your convention) and user selects them for packaging output.
- [ ] Run Prisma migration/regenerate if schema changes are required (prefer minimal changes; only API/logic refactor if possible).

## Testing
- [ ] Run backend typecheck/build.
- [ ] Smoke test: create inventory items (Yetu Plus, Uwezo 1/2, Xpress + bale items), run production, then packaging, verify inventory quantities and movements.

