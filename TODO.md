# TODO - Supplier enhancements

## Step 1: Backend - Supplier document batch upload (no file upload yet)
- [ ] Add endpoint: POST /suppliers/:id/documents/batch
- [ ] Accept JSON array of documents (documentType, title, fileUrl/referenceNo, etc.)
- [ ] Store docs using existing Prisma model SupplierComplianceDocument

## Step 2: Backend - Supplier lock capability
- [ ] Add schema fields to Supplier: isLocked (and optional lockedAt)
- [ ] Add endpoint: PATCH /suppliers/:id/lock { isLocked }
- [ ] Ensure lock state returned by GET /suppliers and affects UI rendering

## Step 3: Backend - Supplier ordering newest-first
- [ ] Change supplier list ordering to createdAt desc

## Step 4: Frontend - Multi-document option when adding supplier
- [ ] Update Add supplier modal to accept document metadata (not raw file upload)
- [ ] Create supplier then call batch documents endpoint

## Step 5: Frontend - Lock button on supplier detail
- [ ] Add Lock/Unlock button shown when supplier is active
- [ ] Toggle lock via API and refresh supplier state

## Step 6: Frontend/Client wiring
- [ ] Update procurementClient and TS types for new endpoints/fields

## Step 7: Validation
- [ ] Run prisma migration
- [ ] Run backend tests/build (if any)
- [ ] Run frontend typecheck/build

