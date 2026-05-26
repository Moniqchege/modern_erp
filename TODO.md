# TODO

## PackagingForm refactor (remaining pass)
- [x] Update `fetchInventory()` to initialize `packagingMaterialRows` from packaging-type inventory items.
- [x] Replace legacy single “Pkg received/consumed/destroyed” JSX section with per-row inputs bound to `packagingMaterialRows`.
- [x] Update `handleSubmit()` to send `packagingMaterials: packagingMaterialRows.map(...)`.
- [x] Remove all remaining legacy references (`packagingMaterialReceived/Consumed/Destroyed`) and reset `packagingMaterialRows` after successful submit.
- [x] Run frontend build/typecheck and fix any TS errors.


