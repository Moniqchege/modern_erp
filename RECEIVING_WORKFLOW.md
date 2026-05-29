# Procurement Receiving & QC Workflow

## Overview
The receiving workflow has been restructured into **3 independent pages** for different departments/managers, plus a **central GRN management dashboard** with analytics and approval workflow.

---

## Pages & Routes

### 1. **Weighbridge Station** (`/procurement/weighbridge`)
**Manager:** Weighbridge Operator  
**File:** `frontend/src/pages/procurement/Weighbridge.tsx`

**Responsibilities:**
- Select an issued Purchase Order
- Record truck registration and driver name
- Capture gross weight and tare weight (auto-calculates net weight)
- **Automatically creates GRN draft** with weighbridge ticket ID
- GRN is sent to lab with status `PENDING_QC`

**Flow:**
1. Operator selects PO from dropdown (filters ISSUED/PARTIALLY_RECEIVED)
2. Enters truck details and weights
3. Clicks "Record & Create GRN"
4. System creates weighbridge ticket + auto-generates GRN
5. GRN appears in Lab queue

---

### 2. **Quality Control Lab** (`/procurement/lab`)
**Manager:** Lab Technician / QC Officer  
**File:** `frontend/src/pages/procurement/Lab.tsx`

**Responsibilities:**
- View all GRNs in `PENDING_QC` status
- Enter lab test results for each delivery
- System auto-evaluates grade and price deductions
- Submit QC results (does NOT post GRN)

**Lab Tests (Maize/Raw Material):**
- Moisture Content (%) — Limit: 14%
- Aflatoxin (ppb) — Limit: 10 ppb
- Rotten/Broken (%) — Deduction if >3%
- Foreign Matter (%) — Deduction if >2%
- Live Insects (count) — Any count = full rejection
- Accepted Quantity (kg) — Optional override

**Auto-Evaluation Logic:**
- **FULL_REJECTION:** Aflatoxin ≥10 ppb OR live insects >0 OR moisture ≥16% OR foreign matter ≥5%
- **FAILED_CONDITIONAL:** Minor deductions (moisture 14-16%, rotten/broken >3%, foreign matter 2-5%)
- **PASSED:** All parameters within limits

**Grades:**
- **GRADE_A:** All parameters perfect
- **GRADE_B:** Moisture slightly high or minor rotten/broken
- **GRADE_C:** Multiple minor issues
- **REJECT:** Critical failures

**Price Deductions:**
- Moisture: 2% per 1% over limit
- Rotten/Broken: 1% per 1% over 3%
- Foreign Matter: 1% per 1% over 2%
- Max deduction: 25%

---

### 3. **GRN Management & Approval** (`/procurement/receiving`)
**Manager:** Procurement Manager / GRN Approver  
**File:** `frontend/src/pages/procurement/GRNManagement.tsx`

**Responsibilities:**
- View analytics dashboard (total GRNs, pending QC, ready to post, posted, rejected)
- Review GRNs that passed QC and are ready to post
- **Final approval:** Post GRN to inventory
- View all GRNs history

**Analytics Cards:**
- Total GRNs
- Pending QC (awaiting lab results)
- Ready to Post (QC passed, awaiting approval)
- Posted (total weight in kg)
- Grade A Deliveries (% of total)
- Rejected (failed QC)

**Approval Queue:**
- Shows GRNs where `status = PENDING_QC` AND QC passed AND `blocksInventoryPost = false`
- Displays: GRN number, PO, supplier, batch code, QC grade, price deduction, received date
- "Approve & Post" button triggers final posting

**What Happens on Post:**
- GRN status → `POSTED`
- Creates `InventoryMovement` records (type: `RECEIPT`) for each line
- Increments `InventoryItem.quantity` (stock ledger balance)
- Updates `PurchaseOrderLine.quantityReceived`
- Updates PO status to `PARTIALLY_RECEIVED` or `FULLY_RECEIVED`
- Records `netWeightAccepted`, `postedAt`, `postedBy`
- Fires domain events: `GRN_POSTED`, `INVENTORY_RECEIPT`

---

## Backend Services

### `receiving.service.ts`
**Functions:**
1. `recordWeighbridgeTicket()` — Creates weighbridge ticket with net weight calculation
2. `submitProcurementQC()` — Creates QC result, runs `evaluateMaizeQC()`, sets `blocksInventoryPost` flag
3. `createGrnDraft()` — Creates GRN in `PENDING_QC` status with auto-generated `batchTraceCode`
4. `postGrn()` — **Atomic transaction:** checks QC gate, creates inventory movements, updates stock, updates PO status

### `helpers.ts`
**Functions:**
- `evaluateMaizeQC()` — Business logic for QC evaluation (grade, deduction, rejection)
- `nextSequence()` — Generates sequential numbers (WB-YYYY-XXXXX, GRN-YYYY-XXXXX, QC-YYYY-XXXXX)
- `toDecimal()` — Converts numbers to Prisma Decimal type

---

## API Endpoints

### Weighbridge
- `POST /api/procurement/weighbridge/tickets` — Record weighbridge ticket

### GRN
- `GET /api/procurement/grns` — List all GRNs (with lines, PO, supplier, QC results)
- `POST /api/procurement/grns` — Create GRN draft
- `POST /api/procurement/grns/:id/post` — Post GRN to inventory (final approval)

### QC
- `POST /api/procurement/qc/maize` — Submit maize/raw material QC results
- `POST /api/procurement/qc/packaging` — Submit packaging QC results

---

## Database Models

### `WeighbridgeTicket`
- `ticketNumber` (unique, auto-generated)
- `purchaseOrderId` (FK)
- `truckRegistration`, `driverName`
- `grossWeightKg`, `tareWeightKg`, `netWeightKg`
- `operatorName`, `weighedInAt`

### `GoodsReceivedNote`
- `grnNumber` (unique, auto-generated)
- `purchaseOrderId` (FK)
- `weighbridgeTicketId` (FK, optional)
- `status` (DRAFT / PENDING_QC / POSTED / REJECTED / CANCELLED)
- `deliverySequence` (1, 2, 3... for split deliveries)
- `batchTraceCode` (LOT-YYYY-GRN-XXXXX)
- `receivedBy`, `receivedAt`
- `netWeightAccepted`, `postedAt`, `postedBy`
- Relations: `lines[]`, `qcResults[]`

### `GoodsReceivedNoteLine`
- `grnId` (FK)
- `purchaseOrderLineId` (FK)
- `quantityAccepted`, `quantityRejected`
- `unitPriceApplied`, `lineTotal`
- `lotNumber` (optional)

### `ProcurementQCLabResult`
- `qcNumber` (unique, auto-generated)
- `category` (RAW_MATERIAL / PACKAGING / MILLING_CONSUMABLE / ENGINEERING_SPARE)
- `grnId` (FK)
- `status` (PENDING / PASSED / FAILED_CONDITIONAL / FULL_REJECTION)
- `testedBy`, `testedAt`
- Maize fields: `moistureContentPct`, `aflatoxinPpb`, `rottenBrokenPct`, `foreignMatterPct`, `liveInsectsCount`
- `assignedGrade` (GRADE_A / GRADE_B / GRADE_C / REJECT)
- `priceDeductionPct`, `acceptedQuantity`
- `blocksInventoryPost` (boolean — if true, GRN cannot be posted)
- `rejectionNote`, `remarks`

### `InventoryMovement`
- `itemId` (FK to InventoryItem)
- `movementType` (RECEIPT / ISSUE / ADJUSTMENT / TRANSFER_IN / TRANSFER_OUT)
- `quantityDelta` (positive for receipts, negative for issues)
- `unitPriceApplied`
- `supplierId` (FK, for receipts)
- `grnLineId` (FK, for receipts)
- `notes`

---

## Workflow Summary

```
┌─────────────────┐
│  Weighbridge    │  1. Record truck weights
│   Operator      │  2. Auto-create GRN (PENDING_QC)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Lab Technician │  3. Enter QC test results
│                 │  4. System evaluates grade/deduction
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GRN Manager    │  5. Review analytics
│                 │  6. Approve & Post GRN
│                 │  7. Inventory updated automatically
└─────────────────┘
```

---

## Key Features

✅ **Independent Pages:** Each department works in isolation without interfering  
✅ **Auto-Evaluation:** QC results auto-calculate grade and price deductions  
✅ **Analytics Dashboard:** Real-time metrics for GRN manager  
✅ **Atomic Posting:** Inventory transactions happen in a single database transaction  
✅ **Traceability:** Every GRN has a unique batch/lot code  
✅ **Split Deliveries:** Multiple GRNs per PO with delivery sequence tracking  
✅ **QC Gate:** GRNs cannot be posted if QC fails critical tests  
✅ **Domain Events:** System publishes events for integration with other modules  

---

## Navigation

From the main GRN Management page, quick action buttons navigate to:
- **Go to Weighbridge** → `/procurement/weighbridge`
- **Go to Lab** → `/procurement/lab`

All three pages are also accessible from the main procurement menu.
