# Requirements Document

## Introduction

This feature manages the movement of packed flour bales from the Packaging Store to the Dispatch Store within the flour mill ERP system. After a packaging run completes, produced bales are credited to the Packaging Store inventory. Two transfer workflows are supported: (1) the Packaging Store manager proactively pushes bales to the Dispatch Store, and (2) the Dispatch Store manager requests bales from the Packaging Store. Both workflows support multi-item transfers (multiple flour bale types in a single request). The feature builds on top of the existing `StockTransferRequest` infrastructure while introducing Packaging-Store–to–Dispatch-Store specific RBAC rules and inventory tracking.

## Glossary

- **Bale**: A packaged unit of flour produced during a packaging run (e.g. NYLON_BALER_1KG, BAG_10KG). Represented as an `InventoryItem` with unit `BALE` or `UNIT`.
- **Packaging_Store**: The `InventoryLocation` with code `PACKAGING_STORE`. Holds finished bales produced by packaging runs.
- **Dispatch_Store**: The `InventoryLocation` with code `DISPATCH_STORE`. Holds bales ready for customer dispatch.
- **Packaging_Store_Manager**: A user with role `PACKAGING_STORE_MANAGER` assigned to the Packaging Store.
- **Dispatch_Store_Manager**: A user with role `DISPATCH_STORE_MANAGER` assigned to the Dispatch Store.
- **Push_Transfer**: A transfer initiated by the Packaging Store manager to move bales to the Dispatch Store without a prior request.
- **Pull_Request**: A transfer request initiated by the Dispatch Store manager asking the Packaging Store for specific bale types and quantities.
- **Bale_Transfer**: An umbrella term for both Push_Transfer and Pull_Request workflows.
- **Transfer_Item**: A single line in a Bale_Transfer identifying a bale `InventoryItem` and the quantity being transferred or requested.
- **StoreInventoryBalance**: The per-store, per-item balance record tracking `physicalQty` (on-hand) and `transitQty` (in-transit).
- **Admin**: A user with role `ADMIN` or `SUPERADMIN` who has unrestricted access to all transfer operations.

---

## Requirements

### Requirement 1: Bale Inventory Credited to Packaging Store After Packaging Run

**User Story:** As a Packaging Store Manager, I want newly packed bales to be automatically added to the Packaging Store inventory after every packaging run, so that the Packaging Store balance accurately reflects available stock before any transfer is initiated.

#### Acceptance Criteria

1. WHEN a packaging run status is set to `COMPLETED` within a single database transaction, THE System SHALL increment `StoreInventoryBalance.physicalQty` for the Packaging_Store by the exact bale count produced for each output line; IF the transaction fails for any reason, no balance update SHALL be persisted.
2. WHEN a packaging run output line carries a `typeKey`, THE System SHALL look up the matching `InventoryItem` by that `typeKey` and use the resolved `inventoryItemId` as the balance key; THE System SHALL NOT use the raw `typeKey` string as the balance key.
3. IF a packaging run output line carries a `typeKey` for which no `InventoryItem` record exists in the database, THEN THE System SHALL abort the packaging run completion and return an HTTP 422 error whose message identifies the unresolved `typeKey`.
4. WHEN queried at any point in time, THE Packaging_Store `StoreInventoryBalance.physicalQty` for a given bale type SHALL equal the sum of `qty` from all `COMPLETED` packaging run output lines for that type minus the sum of all `qtyIssued` in `COMPLETED` or `APPROVED_IN_TRANSIT` Bale_Transfers sourced from Packaging_Store for that type.

---

### Requirement 2: Push Transfer — Packaging Store Initiates Bale Movement

**User Story:** As a Packaging Store Manager, I want to push packed bales to the Dispatch Store without waiting for a request, so that I can proactively replenish the Dispatch Store as production output becomes available.

#### Acceptance Criteria

1. WHEN a Packaging_Store_Manager submits a Push_Transfer payload containing at least one Transfer_Item, THE System SHALL create a `StockTransferRequest` record with `sourceLocationId` equal to the Packaging_Store ID and `destinationLocationId` equal to the Dispatch_Store ID.
2. THE Push_Transfer SHALL accept between 1 and 50 Transfer_Items per submission, each specifying a distinct `inventoryItemId` and a numeric quantity greater than 0.000 expressed to at most 3 decimal places.
3. WHEN a Push_Transfer is created, THE System SHALL, within the same atomic database transaction: set transfer status to `APPROVED_IN_TRANSIT`, deduct each Transfer_Item quantity from `Packaging_Store.StoreInventoryBalance.physicalQty`, and increment the same quantity on `Dispatch_Store.StoreInventoryBalance.transitQty`; IF any part of this transaction fails, no status change and no balance adjustment SHALL be persisted.
4. IF the quantity specified for any Transfer_Item exceeds `Packaging_Store.StoreInventoryBalance.physicalQty` for that item at the time of creation, THEN THE System SHALL reject the Push_Transfer with an HTTP 422 error identifying the item name and its available quantity; no record SHALL be created.
5. IF `Packaging_Store.StoreInventoryBalance.physicalQty` for any Transfer_Item is zero or negative at the time of creation, THEN THE System SHALL reject the Push_Transfer with an HTTP 422 error identifying the item; no record SHALL be created.
6. IF a Push_Transfer payload contains two or more Transfer_Items that share the same `inventoryItemId`, THEN THE System SHALL reject the request with an HTTP 400 validation error before any database write occurs.
7. WHEN a Push_Transfer record is created, THE System SHALL assign a `requestNumber` unique for the calendar day following the `STR-YYYYMMDD-NNNN` format, where NNNN is a zero-padded sequence starting at 0001 and incrementing per record created on that date.
8. THE Push_Transfer record SHALL store the `id` of the authenticated Packaging_Store_Manager as `requestedByUserId`.
9. IF the authenticated user does not hold the `PACKAGING_STORE_MANAGER` role (or `ADMIN` / `SUPERADMIN`), THEN THE System SHALL reject the Push_Transfer request with an HTTP 403 error before any database write occurs.

---

### Requirement 3: Pull Request — Dispatch Store Requests Bales from Packaging Store

**User Story:** As a Dispatch Store Manager, I want to request specific bale types and quantities from the Packaging Store, so that I can ensure the Dispatch Store is stocked according to anticipated customer demand.

#### Acceptance Criteria

1. WHEN a Dispatch_Store_Manager submits a Pull_Request payload containing at least one Transfer_Item, THE System SHALL create a `StockTransferRequest` record with `sourceLocationId` equal to the Packaging_Store ID, `destinationLocationId` equal to the Dispatch_Store ID, and status `PENDING`.
2. THE Pull_Request SHALL accept between 1 and 50 Transfer_Items per submission, each specifying a distinct `inventoryItemId` and a numeric quantity greater than 0.000 expressed to at most 3 decimal places.
3. WHEN a Pull_Request record is created, THE System SHALL NOT modify any `StoreInventoryBalance.physicalQty` or `transitQty` field; all inventory adjustments SHALL be deferred until a Packaging_Store_Manager issues the request.
4. IF a Pull_Request payload contains two or more Transfer_Items that share the same `inventoryItemId`, or references an `inventoryItemId` that does not exist in the database, THEN THE System SHALL reject the request with an HTTP 400 validation error and SHALL NOT create any `StockTransferRequest` record or related rows.
5. WHEN a Pull_Request record is created, THE System SHALL assign a `requestNumber` unique for the calendar day following the `STR-YYYYMMDD-NNNN` format, where NNNN is a zero-padded sequence starting at 0001 and incrementing per record created on that date.
6. THE Pull_Request record SHALL store the `id` of the authenticated Dispatch_Store_Manager as `requestedByUserId`.
7. IF the authenticated user does not hold the `DISPATCH_STORE_MANAGER` role (or `ADMIN` / `SUPERADMIN`), THEN THE System SHALL reject the Pull_Request with an HTTP 403 error before any database write occurs.

---

### Requirement 4: Packaging Store Reviews and Issues a Pull Request

**User Story:** As a Packaging Store Manager, I want to review pending Pull Requests and issue the requested bales (with optional partial fulfillment), so that I maintain control over what leaves the Packaging Store.

#### Acceptance Criteria

1. WHEN a Packaging_Store_Manager issues a Pull_Request whose current status is `PENDING` or `PENDING_CORRECTION`, THE System SHALL, within the same atomic database transaction: update the transfer status to `APPROVED_IN_TRANSIT`, deduct each issued quantity from `Packaging_Store.StoreInventoryBalance.physicalQty`, and increment the same quantity on `Dispatch_Store.StoreInventoryBalance.transitQty`; IF any part fails, no status change and no balance adjustment SHALL be persisted.
2. WHEN a Packaging_Store_Manager supplies an issued quantity for a Transfer_Item that is greater than zero but less than the item's requested quantity, THE System SHALL record the issued quantity on the Transfer_Item row and SHALL require a `partialIssueReason` string of between 1 and 1000 characters; IF `partialIssueReason` is absent or empty, THE System SHALL reject the issuance with an HTTP 422 error.
3. IF the issued quantity supplied for any Transfer_Item is less than or equal to zero, or exceeds `Packaging_Store.StoreInventoryBalance.physicalQty` for that item at the moment of issuance, THEN THE System SHALL reject the entire issuance request with an HTTP 422 error identifying the item name and the available quantity; no balance or status change SHALL be persisted.
4. WHEN a Packaging_Store_Manager rejects a Pull_Request whose current status is `PENDING`, THE System SHALL update the transfer status to `REJECTED` and SHALL require a `rejectionReason` string of between 1 and 2000 characters; IF `rejectionReason` is absent or empty, THE System SHALL reject the action with an HTTP 422 error.
5. IF the authenticated user does not hold the `PACKAGING_STORE_MANAGER` role (or `ADMIN` / `SUPERADMIN`), THEN THE System SHALL reject any attempt to issue or reject a Pull_Request sourced from Packaging_Store with an HTTP 403 error.

---

### Requirement 5: Dispatch Store Acknowledges Receipt of Bales

**User Story:** As a Dispatch Store Manager, I want to confirm receipt of transferred bales and record the actual quantities received, so that the Dispatch Store inventory is accurate and any discrepancies are documented.

#### Acceptance Criteria

1. WHEN a Dispatch_Store_Manager submits a receipt acknowledgement for a Bale_Transfer in status `APPROVED_IN_TRANSIT`, THE System SHALL, within the same atomic database transaction: update the transfer status to `COMPLETED`, decrement each received quantity from `Dispatch_Store.StoreInventoryBalance.transitQty`, and increment the same received quantity on `Dispatch_Store.StoreInventoryBalance.physicalQty`; IF the transaction fails, no status change and no balance adjustment SHALL be persisted.
2. WHEN the received quantity for a Transfer_Item is greater than 0.000 but strictly less than the issued quantity, THE System SHALL create a `StockTransferDiscrepancy` record containing `transferItemId`, `qtyIssued`, `qtyReceived`, and `qtyShort` (where `qtyShort` = `qtyIssued` − `qtyReceived`).
3. IF the received quantity supplied for any Transfer_Item exceeds the issued quantity for that item, THEN THE System SHALL reject the entire acknowledgement request with an HTTP 422 error identifying the offending item; no status change, no balance adjustment, and no discrepancy record SHALL be persisted.
4. IF the received quantity supplied for any Transfer_Item is zero or negative, THEN THE System SHALL reject the acknowledgement request with an HTTP 422 error identifying the offending item; no changes SHALL be persisted.
5. WHEN a receipt acknowledgement is successfully committed, THE System SHALL set `StockTransferRequest.completedAt` to the UTC timestamp of the commit.
6. IF the authenticated user does not hold the `DISPATCH_STORE_MANAGER` role (or `ADMIN` / `SUPERADMIN`), THEN THE System SHALL reject the acknowledgement request with an HTTP 403 error before any database write occurs.

---

### Requirement 6: Dispatch Store Rejects a Delivery

**User Story:** As a Dispatch Store Manager, I want to reject an incoming bale delivery if the goods are incorrect or damaged, so that the Packaging Store can correct and re-issue the transfer.

#### Acceptance Criteria

1. WHEN a Dispatch_Store_Manager submits a rejection for a Bale_Transfer in status `APPROVED_IN_TRANSIT`, THE System SHALL, within the same atomic database transaction: update the transfer status to `PENDING_CORRECTION`, decrement the full `transitQty` held at Dispatch_Store for each Transfer_Item back to zero, and restore the same quantities to `Packaging_Store.StoreInventoryBalance.physicalQty`; IF the transaction fails, no status change and no balance adjustment SHALL be persisted.
2. WHEN a rejection is submitted, THE System SHALL require a `receiptRejectionReason` string of between 1 and 2000 characters; IF the field is absent or empty, THE System SHALL return an HTTP 422 error and no changes SHALL be persisted.
3. WHEN a Packaging_Store_Manager re-issues a Bale_Transfer in status `PENDING_CORRECTION`, THE System SHALL clear `receiptRejectionReason` and `receiptRejectedAt` on the `StockTransferRequest` record and transition the status to `APPROVED_IN_TRANSIT`, applying the same inventory adjustments defined in Requirement 4 Criterion 1.
4. IF the authenticated user does not hold the `DISPATCH_STORE_MANAGER` role (or `ADMIN` / `SUPERADMIN`), THEN THE System SHALL reject the delivery rejection request with an HTTP 403 error before any database write occurs.

---

### Requirement 7: Transfer Visibility and Listing

**User Story:** As a store manager, I want to view only the transfers relevant to my store, so that I can manage my workload without being distracted by unrelated transfers.

#### Acceptance Criteria

1. WHEN a Packaging_Store_Manager requests the list of Bale_Transfers, THE System SHALL return only `StockTransferRequest` records where `sourceLocationId` or `destinationLocationId` equals the Packaging_Store ID.
2. WHEN a Dispatch_Store_Manager requests the list of Bale_Transfers, THE System SHALL return only `StockTransferRequest` records where `sourceLocationId` or `destinationLocationId` equals the Dispatch_Store ID.
3. WHEN an Admin requests the list of Bale_Transfers, THE System SHALL return all `StockTransferRequest` records regardless of location; IF a database error occurs during retrieval, THE System SHALL return an HTTP 500 error.
4. THE System SHALL support filtering the Bale_Transfer list by `status`, accepting any one of the following exact values: `PENDING`, `APPROVED_IN_TRANSIT`, `COMPLETED`, `REJECTED`, or `PENDING_CORRECTION`; IF an unrecognised status value is supplied, THE System SHALL return an HTTP 400 error.
5. WHEN a Bale_Transfer list response is returned, THE System SHALL include for each entry: `requestNumber`, `status`, source store name, destination store name, requesting user display name, all Transfer_Items each with `inventoryItemName`, `qtyRequested`, `qtyIssued`, and `qtyReceived`, and the timestamps `createdAt`, `approvedAt`, `completedAt`, and `receiptRejectedAt`.

---

### Requirement 8: Bale Transfer Input Validation

**User Story:** As any store manager, I want the system to validate my transfer inputs immediately, so that I receive clear, actionable feedback before any inventory changes are made.

#### Acceptance Criteria

1. IF a Bale_Transfer submission contains an empty `items` array or omits the `items` field entirely, THEN THE System SHALL return an HTTP 400 error with the message "At least one transfer item is required" before any database write occurs.
2. IF any Transfer_Item in the submission carries a quantity that is not a finite number, is less than or equal to zero, or has more than 3 decimal places, THEN THE System SHALL return an HTTP 400 error that identifies the `inventoryItemId` of the offending item and states the quantity constraint.
3. IF the `sourceLocationId` and `destinationLocationId` in a Bale_Transfer submission are identical, THEN THE System SHALL return an HTTP 400 error stating that source and destination must differ before any database write occurs.
4. IF any Transfer_Item references an `inventoryItemId` that does not correspond to an existing `InventoryItem` record, THEN THE System SHALL return an HTTP 422 error that identifies the missing `inventoryItemId`.
5. THE System SHALL evaluate all Transfer_Item validation rules (criteria 1–4 above) before executing any database write; WHEN all validations pass, THE System SHALL execute all inventory adjustments within a single database transaction such that either every adjustment is committed or none are.
