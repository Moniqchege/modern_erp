# TODO

## Packaging endpoint fix
- [ ] Update backend schema/logic so `packedBaleInventoryItemId` can be omitted or empty and is auto-derived
- [ ] Add safe defaulting in `processPackaging`/`processPackagingRun` for empty string bale ids
- [ ] Update frontend payload to never send empty `packedBaleInventoryItemId`
- [ ] Add minimal tests / run manual validation with sample payload

