-- AlterTable
ALTER TABLE `InventoryItem` ADD COLUMN `reorderLevel` DECIMAL(12, 3) NULL,
    ADD COLUMN `reorderQuantity` DECIMAL(12, 3) NULL;

-- AlterTable
ALTER TABLE `InventoryMovement` ADD COLUMN `packagingRunId` VARCHAR(191) NULL,
    MODIFY `movementType` ENUM('RECEIPT', 'ISSUE_TO_PRODUCTION', 'ISSUE_TO_PACKAGING', 'SALES_DISPATCH', 'ADJUSTMENT') NOT NULL;

-- CreateTable
CREATE TABLE `PackagingRun` (
    `id` VARCHAR(191) NOT NULL,
    `runNumber` VARCHAR(191) NOT NULL,
    `operatorName` VARCHAR(191) NOT NULL,
    `baleWeightKg` DECIMAL(12, 3) NOT NULL DEFAULT 24,
    `grade1FlourConsumed` DECIMAL(12, 3) NOT NULL,
    `grade2FlourConsumed` DECIMAL(12, 3) NOT NULL,
    `flourSpillage` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `packagingMaterialReceived` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `packagingMaterialConsumed` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `packagingMaterialDestroyed` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `balesProducedGrade1` INTEGER NOT NULL DEFAULT 0,
    `balesProducedGrade2` INTEGER NOT NULL DEFAULT 0,
    `totalPackagedKg` DECIMAL(12, 3) NOT NULL,
    `yieldPercent` DECIMAL(5, 2) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PackagingRun_runNumber_key`(`runNumber`),
    INDEX `PackagingRun_runNumber_idx`(`runNumber`),
    INDEX `PackagingRun_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_packagingRunId_fkey` FOREIGN KEY (`packagingRunId`) REFERENCES `PackagingRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
