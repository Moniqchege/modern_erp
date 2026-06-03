-- Add electricityKwh to PackagingRun
ALTER TABLE `PackagingRun` ADD COLUMN `electricityKwh` DECIMAL(10,3) NULL;

-- Add per-flour spillage to PackagingRunFinishedProductInput
ALTER TABLE `PackagingRunFinishedProductInput` ADD COLUMN `flourSpillageKg` DECIMAL(12,3) NOT NULL DEFAULT 0.000;
