# Requirements Document

## Introduction

This feature extends the inventory module of the modern-erp system to support store onboarding — the ability for administrators to register new stores, assign store managers to those stores, and manage store-level configuration. Currently, stores are hard-coded as a fixed set of four `StoreCode` enum values seeded at runtime. The onboarding feature replaces this static approach with a dynamic, admin-managed store registry, while preserving all existing stock transfer and RBAC behaviour for current stores.

## Glossary

- **Store**: A physical or logical inventory location within the organisation, represented in the system by an `InventoryLocation` record.
- **Store_Registry**: The managed list of all registered stores in the system, backed by `InventoryLocation` records.
- **Store_Manager**: A `User` whose role grants them scoped access to exactly one store (e.g. `MAIN_STORE_MANAGER`, `PACKAGING_STORE_MANAGER`). After onboarding, store-manager assignments are tracked via a dedicated `StoreManagerAssignment` record linking a `User` to a `Store`.
- **Store_Onboarding_Service**: The backend service responsible for creating stores, assigning managers, and managing store configuration.
- **Admin**: A `User` with role `ADMIN` or `SUPERADMIN`, who is authorised to perform store onboarding and management operations.
- **RBAC**: Role-Based Access Control — the existing permission system that governs which users can read, write, or approve operations per store.
- **StoreCode**: The unique, machine-readable identifier for a store (e.g. `MAIN_STORE`). For new dynamic stores this is a slug derived from the store name.
- **Store_Configuration**: A set of optional metadata attached to a store, including physical address, description, and whether the store is active.
- **Active_Store**: A store with `isActive = true` that participates in stock transfers and balance tracking.
- **Inactive_Store**: A store with `isActive = false` that is hidden from operational workflows but whose history is preserved.

---

## Requirements

### Requirement 1: Register a New Store

**User Story:** As an Admin, I want to register a new store, so that the organisation can onboard additional inventory locations without requiring code changes or redeployment.

#### Acceptance Criteria

1. WHEN an Admin submits a valid store registration request containing a unique name and store code, THE Store_Onboarding_Service SHALL create a new `InventoryLocation` record with `isActive = true`.
2. THE Store_Onboarding_Service SHALL reject store registration where the provided store code already exists, returning an error that identifies the conflicting store code.
3. THE Store_Onboarding_Service SHALL reject store registration where the provided name is blank or exceeds 255 characters, returning a descriptive validation error.
4. THE Store_Onboarding_Service SHALL reject store registration where the store code is blank, contains whitespace, or exceeds 64 characters, returning a descriptive validation error.
5. WHEN a store is successfully registered, THE Store_Onboarding_Service SHALL return the complete store record including the generated `id`, `code`, `name`, `isActive` flag, and `createdAt` timestamp.
6. IF a non-Admin user attempts to register a store, THEN THE Store_Onboarding_Service SHALL return a 403 Forbidden error.

---

### Requirement 2: List All Stores

**User Story:** As an Admin or Store_Manager, I want to view a list of all registered stores, so that I can see the current store registry and identify which stores are active.

#### Acceptance Criteria

1. WHEN an authenticated user requests the store list, THE Store_Onboarding_Service SHALL return all `InventoryLocation` records ordered by name ascending.
2. WHEN an authenticated user requests the store list, THE Store_Onboarding_Service SHALL include for each store: `id`, `code`, `name`, `isActive`, `description`, `address`, and `createdAt`.
3. WHEN an Admin requests the store list, THE Store_Onboarding_Service SHALL return all stores regardless of `isActive` status.
4. WHEN a non-Admin authenticated user requests the store list, THE Store_Onboarding_Service SHALL return only stores with `isActive = true`.
5. IF an unauthenticated request is made to the store list endpoint, THEN THE Store_Onboarding_Service SHALL return a 401 Unauthorised error.

---

### Requirement 3: Update Store Configuration

**User Story:** As an Admin, I want to update a store's name, description, and address, so that store metadata stays accurate without creating a new store.

#### Acceptance Criteria

1. WHEN an Admin submits a valid update request for an existing store, THE Store_Onboarding_Service SHALL update the `InventoryLocation` record and return the updated store.
2. THE Store_Onboarding_Service SHALL allow partial updates — only fields present in the request body SHALL be modified; absent fields SHALL remain unchanged.
3. THE Store_Onboarding_Service SHALL reject an update where the new name is blank or exceeds 255 characters, returning a descriptive validation error.
4. THE Store_Onboarding_Service SHALL reject an update where the new description exceeds 1000 characters, returning a descriptive validation error.
5. THE Store_Onboarding_Service SHALL reject an update where the new address exceeds 500 characters, returning a descriptive validation error.
6. IF an Admin attempts to update a store that does not exist, THEN THE Store_Onboarding_Service SHALL return a 404 Not Found error.
7. IF a non-Admin user attempts to update a store, THEN THE Store_Onboarding_Service SHALL return a 403 Forbidden error.

---

### Requirement 4: Activate and Deactivate Stores

**User Story:** As an Admin, I want to deactivate a store that is no longer operational and reactivate it when needed, so that inactive stores are excluded from operational workflows without losing their history.

#### Acceptance Criteria

1. WHEN an Admin submits a deactivation request for an active store, THE Store_Onboarding_Service SHALL set `isActive = false` on the `InventoryLocation` record and return the updated store.
2. WHEN an Admin submits an activation request for an inactive store, THE Store_Onboarding_Service SHALL set `isActive = true` on the `InventoryLocation` record and return the updated store.
3. WHILE a store is inactive, THE Stock_Transfer_Service SHALL reject any new stock transfer request that designates the inactive store as source or destination, returning a descriptive error.
4. WHILE a store is inactive, THE Store_Onboarding_Service SHALL exclude the store from store-selector responses used by non-Admin users.
5. IF an Admin attempts to deactivate a store that has stock transfer requests in `PENDING` or `APPROVED_IN_TRANSIT` status, THEN THE Store_Onboarding_Service SHALL return a 409 Conflict error listing the in-flight transfer count.
6. IF an Admin attempts to deactivate or activate a store that does not exist, THEN THE Store_Onboarding_Service SHALL return a 404 Not Found error.
7. IF a non-Admin user attempts to deactivate or activate a store, THEN THE Store_Onboarding_Service SHALL return a 403 Forbidden error.

---

### Requirement 5: Assign a Store Manager

**User Story:** As an Admin, I want to assign a user as the manager of a specific store, so that the user gains scoped access to that store's inventory operations.

#### Acceptance Criteria

1. WHEN an Admin assigns a user to a store, THE Store_Onboarding_Service SHALL validate inputs in the following order and return the first error encountered:
   - (i) IF the requesting user is not an Admin, THEN return a 403 Forbidden error.
   - (ii) IF the target user does not exist, THEN return a 404 Not Found error identifying the user.
   - (iii) IF the target store does not exist, THEN return a 404 Not Found error identifying the store.
   - (iv) IF the target store has `isActive = false`, THEN return a 409 Conflict error stating the store is inactive.
2. WHEN all validations pass, THE Store_Onboarding_Service SHALL create a `StoreManagerAssignment` record linking the user and the store with an `assignedAt` timestamp.
3. THE Store_Onboarding_Service SHALL enforce that a user holds at most one active store manager assignment at a time; assigning the same user to a different store SHALL replace the existing assignment.
4. WHEN a store manager assignment is created or replaced, THE Store_Onboarding_Service SHALL return the complete assignment record including `userId`, `storeId`, `storeCode`, `assignedAt`, and the user's name and email.

---

### Requirement 6: Remove a Store Manager Assignment

**User Story:** As an Admin, I want to remove a store manager from a store, so that a user no longer has scoped access when they change roles or leave.

#### Acceptance Criteria

1. WHEN an Admin removes the manager assignment for a user, THE Store_Onboarding_Service SHALL delete the `StoreManagerAssignment` record and return a success confirmation.
2. IF an Admin attempts to remove a manager assignment that does not exist, THEN THE Store_Onboarding_Service SHALL return a 404 Not Found error.
3. IF a non-Admin user attempts to remove a manager assignment, THEN THE Store_Onboarding_Service SHALL return a 403 Forbidden error.

---

### Requirement 7: View Store Manager Assignments

**User Story:** As an Admin, I want to list the current manager assignments for all stores, so that I can audit which users are managing which stores.

#### Acceptance Criteria

1. WHEN an Admin requests the manager assignment list, THE Store_Onboarding_Service SHALL return all `StoreManagerAssignment` records, each including the store code, store name, user name, and user email.
2. WHEN an Admin requests assignments for a specific store, THE Store_Onboarding_Service SHALL return only the assignments for that store.
3. IF a non-Admin user requests the manager assignment list, THEN THE Store_Onboarding_Service SHALL return a 403 Forbidden error.

---

### Requirement 8: RBAC Enforcement for Dynamic Stores

**User Story:** As an Admin, I want the RBAC rules for stock transfer and store balance access to apply to dynamically registered stores, so that security guarantees are consistent regardless of how a store was created.

#### Acceptance Criteria

1. WHEN a stock transfer request is created, THE Stock_Transfer_Service SHALL resolve the requesting user's permitted store from their active `StoreManagerAssignment` record rather than solely from a hard-coded role-to-store mapping.
2. WHEN store balance visibility is computed, THE Store_Onboarding_Service SHALL restrict a store manager's view to only the store referenced by their active `StoreManagerAssignment`.
3. THE Store_Onboarding_Service SHALL preserve the existing hard-coded role-to-store mapping for legacy `StoreCode` enum values (`MAIN_STORE`, `PACKAGING_STORE`, `MAIZE_STORE`, `DISPATCH_STORE`) so that no existing functionality is broken.
4. WHEN a user has no active `StoreManagerAssignment` and no hard-coded role-to-store mapping, THE Stock_Transfer_Service SHALL deny that user the ability to create stock transfer requests.

---

### Requirement 9: Store Onboarding Audit Log

**User Story:** As an Admin, I want every store creation, update, activation/deactivation, and manager assignment change to be logged, so that I can audit the history of store configuration changes.

#### Acceptance Criteria

1. WHEN any store onboarding operation succeeds (create, update, activate, deactivate, assign manager, remove manager), THE Store_Onboarding_Service SHALL write a `StoreAuditLog` record containing the `action`, `storeId`, `performedByUserId`, `timestamp`, and a JSON snapshot of the change.
2. WHEN an Admin requests the audit log for a specific store, THE Store_Onboarding_Service SHALL return all `StoreAuditLog` records for that store ordered by timestamp descending.
3. IF a non-Admin user requests the audit log, THEN THE Store_Onboarding_Service SHALL return a 403 Forbidden error.
