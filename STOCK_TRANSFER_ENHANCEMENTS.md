# Stock Transfer Enhancements

## Overview
Enhanced the stock transfer system to handle two key scenarios:
1. **Main store has insufficient stock** → Main store manager can issue partial quantities or reject
2. **Receiving store receives incorrect quantity/items** → Receiving store manager can reject the entire delivery

---

## New Statuses

### `RECEIPT_REJECTED`
- Set when receiving store manager rejects an **entire delivery**
- Immediately transitions to `PENDING_CORRECTION`

### `PENDING_CORRECTION`
- Transfer is back in main store's queue for correction and re-issue
- Main store manager can review the rejection reason and re-issue with corrected quantities

---

## Updated Flow Diagram

```
┌─────────┐
│ PENDING │  ← Store manager creates request
└────┬────┘
     │
     ├──→ Main store REJECTS → [REJECTED] (end)
     │                          (reason mandatory)
     │
     ├──→ Main store APPROVES & ISSUES
     │    (partial qty allowed: qtyIssued ≤ qtyRequested)
     │
     ▼
┌──────────────────────┐
│ APPROVED_IN_TRANSIT  │
└──────┬───────────────┘
       │
       ├──→ Receiving store REJECTS RECEIPT → [RECEIPT_REJECTED]
       │    • Inventory reversed (returns to main store physical)    │
       │    • Status → PENDING_CORRECTION                           │
       │    • Reason mandatory                                       │
       │    • Main store can now RE-ISSUE                           │
       │                                                              │
       └──→ Receiving store ACKNOWLEDGES                             │
            • Records qtyReceived per line                          │
            • If qtyReceived < qtyIssued → discrepancy logged       │
            • Transfer → [COMPLETED]                                 │
```

---

## Schema Changes

### `StockTransferRequest` Model (Prisma)

**New Fields:**
```prisma
receiptRejectionReason  String?   @db.Text
receiptRejectedByUserId String?
receiptRejectedBy       User?     @relation(...)
receiptRejectedAt       DateTime?
```

**Updated Enum:**
```prisma
enum StockTransferStatus {
  PENDING
  APPROVED_IN_TRANSIT
  COMPLETED
  REJECTED
  RECEIPT_REJECTED       // ← new
  PENDING_CORRECTION     // ← new
}
```

**Migration:** `20260603120000_receipt_rejection_and_correction_status`

---

## API Changes

### 1. **POST `/api/stock-transfer/:id/approve-issue`** ✨ Enhanced
**Main store manager approves and issues stock**

**Body (optional):**
```json
{
  "lines": [
    {
      "lineId": "cm5abc123",
      "qtyIssued": 80  // Can be < qtyRequested if stock limited
    }
  ]
}
```

- `qtyIssued` defaults to `qtyRequested` when omitted
- **Partial fulfillment** is allowed: `qtyIssued < qtyRequested`
- If `qtyIssued` is less than requested, the receiving store will see:
  - `qtyRequested: 100`
  - `qtyIssued: 80`
- **Authorization:** Main store manager or admin
- **Valid from status:** `PENDING` or `PENDING_CORRECTION`
- **New status:** `APPROVED_IN_TRANSIT`

**Use case:** Main store has only 80kg of flour but the request was for 100kg

---

### 2. **POST `/api/stock-transfer/:id/reject`** ✨ Updated
**Main store manager rejects the pending request**

**Body (mandatory):**
```json
{
  "rejectionReason": "Stock unavailable for next 2 weeks. Please revise request."
}
```

- `rejectionReason` is now **mandatory** (was optional)
- **Authorization:** Main store manager or admin
- **Valid from status:** `PENDING`
- **New status:** `REJECTED` (terminal)

**Use case:** Request is unnecessary, duplicated, or items won't be available

---

### 3. **POST `/api/stock-transfer/:id/reject-receipt`** 🆕 NEW
**Receiving store manager rejects the entire delivery and returns it**

**Body (mandatory):**
```json
{
  "rejectionReason": "Wrong items delivered — ordered maize flour but received wheat flour"
}
```

**Effect:**
- All in-transit qty **reversed**: removed from destination, returned to main store physical stock
- Transfer status → `PENDING_CORRECTION`
- Main store can review rejection reason and re-issue with corrections

**Authorization:** Receiving store manager (for their own destination store)

**Valid from status:** `APPROVED_IN_TRANSIT`

**New status:** `PENDING_CORRECTION`

**Inventory movements created:**
- Destination: transitQty `-qtyIssued`
- Source (main store): physicalQty `+qtyIssued`
- Movement note: `"Receipt rejected — STR-20260603-0001 returned to MAIN_STORE: <reason>"`

**Use cases:**
- Wrong items delivered
- Severely damaged/contaminated goods
- Quantity far less than expected (major discrepancy)
- Items delivered to wrong store by mistake

---

### 4. **POST `/api/stock-transfer/:id/receive`** (unchanged)
**Receiving store manager acknowledges receipt**

**Body:**
```json
{
  "lines": [
    {
      "lineId": "cm5abc123",
      "qtyReceived": 78  // Can be < qtyIssued (logs discrepancy)
    }
  ]
}
```

- If `qtyReceived < qtyIssued`: discrepancy record created, transfer still completes
- Use `reject-receipt` instead if the delivery is entirely wrong

---

## Service Changes

### `stock-transfer.service.ts`

#### New Functions

**`rejectStockTransferReceipt(auth, transferId, rejectionReason)`**
- Reverses in-transit inventory back to main store physical
- Sets status to `PENDING_CORRECTION`
- Logs rejection reason and user
- Creates inventory movements documenting the return

#### Updated Functions

**`approveAndIssueStockTransfer(...)`**
- Now also accepts transfers in `PENDING_CORRECTION` status (re-issue after rejection)
- Clears previous `receiptRejection*` fields on re-issue
- Clears `qtyReceived` and `discrepancyNote` on line items (fresh start)

**`rejectStockTransferRequest(...)`**
- `rejectionReason` is now **mandatory** (enforced at service layer)

**`acknowledgeStockTransferReceipt(...)`**
- Deletes old discrepancy records before creating new ones (on re-receipt)

---

## RBAC Changes

### `store-rbac.service.ts`

**New Function:**
```typescript
export function assertCanRejectReceipt(role: string, destinationStoreCode: string)
```

- Uses same logic as `assertCanAcknowledgeReceipt`
- Only the receiving store manager (or admin) can reject a receipt
- Cannot reject receipts for other stores

---

## Example Workflows

### Scenario 1: Main Store Has Limited Stock (Partial Fulfillment)

1. **Packaging Store** requests:
   ```json
   {
     "sourceStoreCode": "MAIN_STORE",
     "destinationStoreCode": "PACKAGING_STORE",
     "items": [
       { "itemId": "flour-001", "qtyRequested": 100 }
     ]
   }
   ```
   **Status:** `PENDING`

2. **Main Store Manager** checks inventory and sees only 75kg available:
   ```bash
   POST /api/stock-transfer/{id}/approve-issue
   {
     "lines": [
       { "lineId": "line-001", "qtyIssued": 75 }
     ]
   }
   ```
   **Status:** `APPROVED_IN_TRANSIT`
   - Main store physical: `-75`
   - Packaging store transit: `+75`

3. **Packaging Store Manager** receives and acknowledges:
   ```bash
   POST /api/stock-transfer/{id}/receive
   {
     "lines": [
       { "lineId": "line-001", "qtyReceived": 75 }
     ]
   }
   ```
   **Status:** `COMPLETED`
   - Packaging store transit: `-75`, physical: `+75`
   - Transfer shows: `qtyRequested: 100`, `qtyIssued: 75`, `qtyReceived: 75`

**Result:** Packaging store got 75kg instead of 100kg (visible in UI), no discrepancy

---

### Scenario 2: Wrong Items Delivered (Full Rejection & Correction)

1. **Maize Store** requests maize flour:
   ```json
   {
     "sourceStoreCode": "MAIN_STORE",
     "destinationStoreCode": "MAIZE_STORE",
     "items": [
       { "itemId": "maize-flour-001", "qtyRequested": 50 }
     ]
   }
   ```
   **Status:** `PENDING`

2. **Main Store Manager** approves and ships (accidentally grabs wheat flour):
   ```bash
   POST /api/stock-transfer/{id}/approve-issue
   ```
   **Status:** `APPROVED_IN_TRANSIT`

3. **Maize Store Manager** receives delivery, sees it's the wrong item:
   ```bash
   POST /api/stock-transfer/{id}/reject-receipt
   {
     "rejectionReason": "Wrong item delivered: received wheat flour instead of maize flour (bags labeled WHT-001)"
   }
   ```
   **Status:** `PENDING_CORRECTION`
   **Inventory effect:**
   - Maize store transit: `-50` (removed)
   - Main store physical: `+50` (returned)

4. **Main Store Manager** reviews the rejection reason, locates correct items:
   ```bash
   POST /api/stock-transfer/{id}/approve-issue
   {
     "lines": [
       { "lineId": "line-001", "qtyIssued": 50 }
     ]
   }
   ```
   **Status:** `APPROVED_IN_TRANSIT` (again)
   - Main store physical: `-50` (correct item this time)
   - Maize store transit: `+50`

5. **Maize Store Manager** receives correct items:
   ```bash
   POST /api/stock-transfer/{id}/receive
   {
     "lines": [
       { "lineId": "line-001", "qtyReceived": 50 }
     ]
   }
   ```
   **Status:** `COMPLETED`

---

### Scenario 3: Main Store Rejects Unnecessary Request

1. **Packaging Store** requests an item that main store doesn't stock:
   ```json
   {
     "items": [
       { "itemId": "specialty-flour-999", "qtyRequested": 20 }
     ]
   }
   ```
   **Status:** `PENDING`

2. **Main Store Manager** reviews and rejects:
   ```bash
   POST /api/stock-transfer/{id}/reject
   {
     "rejectionReason": "Specialty flour is procured directly by packaging department, not stocked in main store"
   }
   ```
   **Status:** `REJECTED` (terminal)
   **No inventory movement**

---

## Testing Checklist

- [ ] Main store can issue partial quantities (qtyIssued < qtyRequested)
- [ ] Receiving store sees both qtyRequested and qtyIssued in UI
- [ ] Main store rejection requires a reason (validates on API)
- [ ] Receipt rejection requires a reason (validates on API)
- [ ] Receipt rejection reverses inventory correctly
- [ ] Transfer in PENDING_CORRECTION shows in main store's queue
- [ ] Main store can re-issue a PENDING_CORRECTION transfer
- [ ] Re-issue clears previous rejection fields
- [ ] RBAC: only destination store manager can reject receipt
- [ ] RBAC: only main store manager can reject pending request
- [ ] RBAC: only main store manager can issue/re-issue
- [ ] Inventory movement audit trail includes rejection notes

---

## Migration Instructions

1. **Stop the backend server** (to unlock Prisma DLL)
   ```bash
   # Kill any running node processes
   ```

2. **Generate Prisma client** with new types:
   ```bash
   cd backend
   npx prisma generate
   ```

3. **Apply migration** (already marked as applied):
   ```bash
   npx prisma migrate deploy
   ```

4. **Restart the server**

---

## UI Recommendations

### For Main Store Manager View
- When viewing `PENDING` transfer:
  - Show "Approve & Issue" button
  - Allow specifying `qtyIssued` per line (defaults to `qtyRequested`)
  - Show current physical stock balance per item
  - Show "Reject" button (requires reason)

- When viewing `PENDING_CORRECTION` transfer:
  - Highlight with warning color
  - Show rejection reason from receiving store
  - Show "Re-Issue" button (uses same form as approve-issue)

### For Receiving Store Manager View
- When viewing `APPROVED_IN_TRANSIT` transfer:
  - Show both `qtyRequested` and `qtyIssued` columns
  - Show "Receive" button (enter `qtyReceived` per line)
  - Show "Reject Receipt" button (requires reason)

- When viewing `COMPLETED` transfer:
  - Show `qtyRequested`, `qtyIssued`, `qtyReceived` columns
  - Highlight lines with discrepancies

### Transfer Status Colors
- `PENDING`: Blue
- `PENDING_CORRECTION`: Orange/Warning (for main store attention)
- `APPROVED_IN_TRANSIT`: Yellow
- `COMPLETED`: Green
- `REJECTED`: Red
- `RECEIPT_REJECTED`: (internal, immediately transitions to PENDING_CORRECTION)

---

## API Response Example

```json
{
  "transfer": {
    "id": "cm5abc123",
    "requestNumber": "STR-20260603-0001",
    "status": "PENDING_CORRECTION",
    "sourceLocation": { "code": "MAIN_STORE", "name": "Main Store" },
    "destinationLocation": { "code": "MAIZE_STORE", "name": "Maize Store" },
    "requestedBy": { "name": "John Doe", "role": "MAIZE_STORE_MANAGER" },
    "approvedBy": { "name": "Jane Smith", "role": "MAIN_STORE_MANAGER" },
    "receiptRejectedBy": { "name": "John Doe", "role": "MAIZE_STORE_MANAGER" },
    "receiptRejectionReason": "Wrong item delivered: received wheat flour instead of maize flour",
    "receiptRejectedAt": "2026-06-03T14:30:00Z",
    "items": [
      {
        "id": "line-001",
        "item": { "sku": "MZF-001", "name": "Maize Flour Premium" },
        "qtyRequested": 50,
        "qtyIssued": 50,
        "qtyReceived": null,
        "discrepancyNote": null
      }
    ],
    "discrepancies": []
  }
}
```

---

## Notes

- Partial fulfillment (`qtyIssued < qtyRequested`) does **not** create a discrepancy — it's documented as the approved quantity
- Receipt acknowledgment with `qtyReceived < qtyIssued` **does** create a discrepancy (logged but transfer completes)
- Receipt rejection with mandatory reason **reverses all inventory** and sends transfer back to `PENDING_CORRECTION`
- Main store manager sees `PENDING_CORRECTION` transfers in their queue with the rejection reason clearly visible
