# TODO - Dashboard data (remove hardcoded values)

- [ ] Inspect existing dashboard page and identify all hardcoded sections
- [ ] Add backend API endpoint(s) that return dashboard summary + activity + yield history
- [ ] Implement computation using Prisma models:
  - Raw maize stock: sum(currentQuantity) for RawMaizeBatch where status=APPROVED
  - Flour stock: sum(currentQuantity) for FinishedGoodsBatch filtered by productType
  - Avg milling efficiency: avg(yieldEfficiency) from ProductionRun (or derived from totals)
  - Yield history (last 6): productionRun.yieldEfficiency ordered desc/asc
  - Recent activity: derive from latest production runs + latest inventory-related updates (inventory movements not used; use productionRun + dispatch logs)
- [ ] Wire frontend Dashboard.tsx to fetch the API and map results into UI stats/cards
- [ ] Replace static SVG chart with dynamic chart data from API
- [ ] Replace recent activity feed with fetched activity items
- [ ] Add loading/error UI states
- [ ] Run backend build/start and frontend dev/build to verify

