-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'EMPLOYEE', 'QC_INSPECTOR', 'WAREHOUSE_OPERATOR') NOT NULL DEFAULT 'EMPLOYEE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryPriceHistory` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InventoryPriceHistory_itemId_effectiveDate_idx`(`itemId`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryItem` (
    `id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('RAW_MATERIAL', 'FINISHED_GOOD', 'BY_PRODUCT') NOT NULL DEFAULT 'FINISHED_GOOD',
    `unit` ENUM('KG', 'BAG', 'TONNE') NOT NULL DEFAULT 'KG',
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 0.00,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InventoryItem_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `movementType` ENUM('RECEIPT', 'ISSUE_TO_PRODUCTION', 'SALES_DISPATCH', 'ADJUSTMENT') NOT NULL,
    `quantityDelta` DECIMAL(12, 3) NOT NULL,
    `unitPriceApplied` DECIMAL(10, 2) NOT NULL,
    `movementAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supplierId` VARCHAR(191) NULL,
    `productionRunId` VARCHAR(191) NULL,
    `dispatchLogId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InventoryMovement_itemId_movementAt_idx`(`itemId`, `movementAt`),
    INDEX `InventoryMovement_movementType_movementAt_idx`(`movementType`, `movementAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `farmLocation` VARCHAR(191) NULL,
    `certifications` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Supplier_code_key`(`code`),
    INDEX `Supplier_code_idx`(`code`),
    INDEX `Supplier_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RawMaizeBatch` (
    `id` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `farmOrigin` VARCHAR(191) NULL,
    `harvestDate` DATETIME(3) NULL,
    `truckRegistration` VARCHAR(191) NOT NULL,
    `driverName` VARCHAR(191) NULL,
    `driverPhone` VARCHAR(191) NULL,
    `grossWeight` DECIMAL(12, 3) NOT NULL,
    `tareWeight` DECIMAL(12, 3) NOT NULL,
    `netWeight` DECIMAL(12, 3) NOT NULL,
    `status` ENUM('QUARANTINED', 'APPROVED', 'REJECTED', 'IN_PRODUCTION', 'CONSUMED') NOT NULL DEFAULT 'QUARANTINED',
    `currentQuantity` DECIMAL(12, 3) NOT NULL,
    `siloId` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RawMaizeBatch_batchNumber_key`(`batchNumber`),
    INDEX `RawMaizeBatch_batchNumber_idx`(`batchNumber`),
    INDEX `RawMaizeBatch_supplierId_idx`(`supplierId`),
    INDEX `RawMaizeBatch_status_idx`(`status`),
    INDEX `RawMaizeBatch_receivedAt_idx`(`receivedAt`),
    INDEX `RawMaizeBatch_expiryDate_idx`(`expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QualityControlLog` (
    `id` VARCHAR(191) NOT NULL,
    `rawMaizeBatchId` VARCHAR(191) NOT NULL,
    `moistureContent` DECIMAL(5, 2) NOT NULL,
    `aflatoxinLevel` DECIMAL(8, 2) NOT NULL,
    `foreignMatter` DECIMAL(5, 2) NOT NULL,
    `brokenKernels` DECIMAL(5, 2) NULL,
    `status` ENUM('QUARANTINED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'QUARANTINED',
    `testedBy` VARCHAR(191) NOT NULL,
    `testDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QualityControlLog_rawMaizeBatchId_idx`(`rawMaizeBatchId`),
    INDEX `QualityControlLog_status_idx`(`status`),
    INDEX `QualityControlLog_testDate_idx`(`testDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Silo` (
    `id` VARCHAR(191) NOT NULL,
    `siloNumber` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `maxCapacity` DECIMAL(12, 3) NOT NULL,
    `currentLevel` DECIMAL(12, 3) NOT NULL DEFAULT 0.00,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastCleanedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Silo_siloNumber_key`(`siloNumber`),
    INDEX `Silo_siloNumber_idx`(`siloNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiloCleaningLog` (
    `id` VARCHAR(191) NOT NULL,
    `siloId` VARCHAR(191) NOT NULL,
    `cleanedBy` VARCHAR(191) NOT NULL,
    `cleaningDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SiloCleaningLog_siloId_idx`(`siloId`),
    INDEX `SiloCleaningLog_cleaningDate_idx`(`cleaningDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionRun` (
    `id` VARCHAR(191) NOT NULL,
    `runNumber` VARCHAR(191) NOT NULL,
    `millingLine` VARCHAR(191) NOT NULL,
    `operatorName` VARCHAR(191) NOT NULL,
    `totalRawInput` DECIMAL(12, 3) NOT NULL,
    `totalFlourOutput` DECIMAL(12, 3) NOT NULL,
    `totalByProductOutput` DECIMAL(12, 3) NOT NULL,
    `moistureLoss` DECIMAL(12, 3) NOT NULL,
    `variance` DECIMAL(12, 3) NOT NULL,
    `variancePercent` DECIMAL(5, 2) NOT NULL,
    `yieldEfficiency` DECIMAL(5, 2) NOT NULL,
    `varianceAlert` BOOLEAN NOT NULL DEFAULT false,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductionRun_runNumber_key`(`runNumber`),
    INDEX `ProductionRun_runNumber_idx`(`runNumber`),
    INDEX `ProductionRun_startTime_idx`(`startTime`),
    INDEX `ProductionRun_varianceAlert_idx`(`varianceAlert`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionRunInput` (
    `id` VARCHAR(191) NOT NULL,
    `productionRunId` VARCHAR(191) NOT NULL,
    `rawMaizeBatchId` VARCHAR(191) NOT NULL,
    `quantityUsed` DECIMAL(12, 3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductionRunInput_productionRunId_idx`(`productionRunId`),
    INDEX `ProductionRunInput_rawMaizeBatchId_idx`(`rawMaizeBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ByProductBatch` (
    `id` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `productionRunId` VARCHAR(191) NOT NULL,
    `productType` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `currentQuantity` DECIMAL(12, 3) NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ByProductBatch_batchNumber_key`(`batchNumber`),
    INDEX `ByProductBatch_batchNumber_idx`(`batchNumber`),
    INDEX `ByProductBatch_productionRunId_idx`(`productionRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinishedGoodsBatch` (
    `id` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `productionRunId` VARCHAR(191) NOT NULL,
    `productType` VARCHAR(191) NOT NULL,
    `totalQuantity` DECIMAL(12, 3) NOT NULL,
    `currentQuantity` DECIMAL(12, 3) NOT NULL,
    `packagingDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiryDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FinishedGoodsBatch_batchNumber_key`(`batchNumber`),
    INDEX `FinishedGoodsBatch_batchNumber_idx`(`batchNumber`),
    INDEX `FinishedGoodsBatch_productionRunId_idx`(`productionRunId`),
    INDEX `FinishedGoodsBatch_expiryDate_idx`(`expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pallet` (
    `id` VARCHAR(191) NOT NULL,
    `palletBarcode` VARCHAR(191) NOT NULL,
    `finishedGoodsBatchId` VARCHAR(191) NOT NULL,
    `totalWeight` DECIMAL(12, 3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pallet_palletBarcode_key`(`palletBarcode`),
    INDEX `Pallet_palletBarcode_idx`(`palletBarcode`),
    INDEX `Pallet_finishedGoodsBatchId_idx`(`finishedGoodsBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bale` (
    `id` VARCHAR(191) NOT NULL,
    `baleBarcode` VARCHAR(191) NOT NULL,
    `palletId` VARCHAR(191) NOT NULL,
    `totalWeight` DECIMAL(12, 3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Bale_baleBarcode_key`(`baleBarcode`),
    INDEX `Bale_baleBarcode_idx`(`baleBarcode`),
    INDEX `Bale_palletId_idx`(`palletId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bag` (
    `id` VARCHAR(191) NOT NULL,
    `bagBarcode` VARCHAR(191) NOT NULL,
    `baleId` VARCHAR(191) NOT NULL,
    `weight` DECIMAL(12, 3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Bag_bagBarcode_key`(`bagBarcode`),
    INDEX `Bag_bagBarcode_idx`(`bagBarcode`),
    INDEX `Bag_baleId_idx`(`baleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DispatchLog` (
    `id` VARCHAR(191) NOT NULL,
    `dispatchNumber` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `truckRegistration` VARCHAR(191) NOT NULL,
    `driverName` VARCHAR(191) NOT NULL,
    `driverPhone` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `loadedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `deliveryAddress` TEXT NOT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DispatchLog_dispatchNumber_key`(`dispatchNumber`),
    INDEX `DispatchLog_dispatchNumber_idx`(`dispatchNumber`),
    INDEX `DispatchLog_customerId_idx`(`customerId`),
    INDEX `DispatchLog_invoiceId_idx`(`invoiceId`),
    INDEX `DispatchLog_status_idx`(`status`),
    INDEX `DispatchLog_loadedAt_idx`(`loadedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DispatchItem` (
    `id` VARCHAR(191) NOT NULL,
    `dispatchLogId` VARCHAR(191) NOT NULL,
    `palletId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DispatchItem_dispatchLogId_idx`(`dispatchLogId`),
    INDEX `DispatchItem_palletId_idx`(`palletId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionBatch` (
    `id` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `rawMaizeConsumed` DECIMAL(12, 3) NOT NULL,
    `grade1Produced` DECIMAL(12, 3) NOT NULL,
    `grade2Produced` DECIMAL(12, 3) NOT NULL,
    `maizeJamProduced` DECIMAL(12, 3) NOT NULL,
    `wasteLoss` DECIMAL(12, 3) NOT NULL,
    `efficiency` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductionBatch_batchNumber_key`(`batchNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `tax` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `issuedAt` DATETIME(3) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_invoiceNumber_key`(`invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InventoryPriceHistory` ADD CONSTRAINT `InventoryPriceHistory_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RawMaizeBatch` ADD CONSTRAINT `RawMaizeBatch_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RawMaizeBatch` ADD CONSTRAINT `RawMaizeBatch_siloId_fkey` FOREIGN KEY (`siloId`) REFERENCES `Silo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityControlLog` ADD CONSTRAINT `QualityControlLog_rawMaizeBatchId_fkey` FOREIGN KEY (`rawMaizeBatchId`) REFERENCES `RawMaizeBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SiloCleaningLog` ADD CONSTRAINT `SiloCleaningLog_siloId_fkey` FOREIGN KEY (`siloId`) REFERENCES `Silo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionRunInput` ADD CONSTRAINT `ProductionRunInput_productionRunId_fkey` FOREIGN KEY (`productionRunId`) REFERENCES `ProductionRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionRunInput` ADD CONSTRAINT `ProductionRunInput_rawMaizeBatchId_fkey` FOREIGN KEY (`rawMaizeBatchId`) REFERENCES `RawMaizeBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ByProductBatch` ADD CONSTRAINT `ByProductBatch_productionRunId_fkey` FOREIGN KEY (`productionRunId`) REFERENCES `ProductionRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsBatch` ADD CONSTRAINT `FinishedGoodsBatch_productionRunId_fkey` FOREIGN KEY (`productionRunId`) REFERENCES `ProductionRun`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pallet` ADD CONSTRAINT `Pallet_finishedGoodsBatchId_fkey` FOREIGN KEY (`finishedGoodsBatchId`) REFERENCES `FinishedGoodsBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bale` ADD CONSTRAINT `Bale_palletId_fkey` FOREIGN KEY (`palletId`) REFERENCES `Pallet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bag` ADD CONSTRAINT `Bag_baleId_fkey` FOREIGN KEY (`baleId`) REFERENCES `Bale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchLog` ADD CONSTRAINT `DispatchLog_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchLog` ADD CONSTRAINT `DispatchLog_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchItem` ADD CONSTRAINT `DispatchItem_dispatchLogId_fkey` FOREIGN KEY (`dispatchLogId`) REFERENCES `DispatchLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DispatchItem` ADD CONSTRAINT `DispatchItem_palletId_fkey` FOREIGN KEY (`palletId`) REFERENCES `Pallet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
