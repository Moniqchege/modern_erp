# TODO - Supplier status unification + lock

## Planned changes
- [x] Update Prisma `Supplier` model to support locking (lockedAt, lockedBy).

- [ ] Add backend route `POST /api/procurement/suppliers/:id/lock`.
- [ ] Implement lock service logic with audit logging.
- [ ] Derive a single supplier table status (backend+frontend):

  - PENDING = onboardingStatus in DRAFT/QA_AUDIT/FINANCE_APPROVAL
  - ACTIVE = onboardingStatus ACTIVE AND NOT locked
  - LOCKED = onboardingStatus ACTIVE AND locked
  - INACTIVE = onboardingStatus in REJECTED/SUSPENDED OR other non-approval states per your rule
- [ ] Update `Suppliers.tsx` to remove separate isActive column and show only one status.
- [ ] Add Lock button on ACTIVE rows (i.e., derived status ACTIVE).
- [ ] Update `StatusBadge.tsx` styles for PENDING/ACTIVE/INACTIVE/LOCKED.
- [ ] Update API client to include lock action.
- [ ] Run backend + frontend build/typecheck.

