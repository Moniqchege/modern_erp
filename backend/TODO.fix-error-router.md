# TODO: Fix Express Router.use() "middleware function but got undefined"

## Information gathered
- Error points to `backend/src/routes/index.ts:23:8` where `routes.use("/traceability", traceabilityRouter);` is called.
- `backend/src/routes/index.ts` imports `traceabilityRouter` as a named export from `./traceability`.
- `backend/src/routes/traceability.ts` defines `const router = Router();` and ends with `export default router;` (no named export).
- Therefore `traceabilityRouter` is `undefined` at runtime, causing `Router.use()` to throw.

## Plan
1. Update `backend/src/routes/traceability.ts` to also export `traceabilityRouter` as a named export (keeping default export if present).
2. Ensure `routes/index.ts` continues to work without further changes.
3. Run `npm run dev` in `backend/` to confirm the server starts.
4. If TypeScript complains about duplicate exports or default/named mismatch, adjust exports/imports consistently.

## Dependent files to edit
- `backend/src/routes/traceability.ts`

## Followup steps
- Execute: `cd backend && npm run dev`
- Optionally run `cd backend && npm run build` (if available) to catch type issues.

