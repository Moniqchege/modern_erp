-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'SUPERADMIN', 'MAIN_STORE_MANAGER', 'MAIZE_STORE_MANAGER', 'PACKAGING_STORE_MANAGER', 'DISPATCH_STORE_MANAGER', 'MANAGER', 'EMPLOYEE', 'QC_INSPECTOR', 'WAREHOUSE_OPERATOR', 'PROCUREMENT_OFFICER', 'FINANCE_DIRECTOR', 'LAB_TECHNICIAN', 'WEIGHBRIDGE_OPERATOR') NOT NULL DEFAULT 'EMPLOYEE',
    `passwordHash` VARCHAR(191) NULL,
    `forcePasswordReset` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpCode` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OtpCode_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PasswordResetToken_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryPriceHistory` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `priceType` ENUM('BUYING', 'SELLING') NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InventoryPriceHistory_itemId_priceType_effectiveDate_idx`(`itemId`, `priceType`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryItem` (
    `id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('RAW_MATERIAL', 'FINISHED_GOOD', 'BY_PRODUCT', 'PACKETS_2KG', 'PACKETS_1KG', 'KHAKI_BALER_2KG', 'KHAKI_BALER_1KG', 'NYLON_BALER_1KG', 'NYLON_BALER_2KG', 'BAG_5KG', 'BAG_10KG', 'LAMINATED_BALER', 'BAG_50KG', 'BAG_90KG', 'CLEAR_TAPES', 'GLUE') NOT NULL DEFAULT 'FINISHED_GOOD',
    `unit` ENUM('KG', 'BAG', 'PIECES', 'BALE', 'UNIT', 'MT', 'GRAMS', 'L') NOT NULL DEFAULT 'KG',
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 0.00,
    `reorderLevel` DECIMAL(12, 3) NULL,
    `reorderQuantity` DECIMAL(12, 3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InventoryItem_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `movementType` ENUM('RECEIPT', 'ISSUE_TO_PRODUCTION', 'ISSUE_TO_PACKAGING', 'SALES_DISPATCH', 'ADJUSTMENT') NOT NULL,
    `quantityDelta` DECIMAL(12, 3) NOT NULL,
    `unitPriceApplied` DECIMAL(10, 2) NOT NULL,
    `movementAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supplierId` VARCHAR(191) NULL,
    `grnLineId` VARCHAR(191) NULL,
    `productionRunId` VARCHAR(191) NULL,
    `packagingRunId` VARCHAR(191) NULL,
    `dispatchLogId` VARCHAR(191) NULL,
    `locationId` VARCHAR(191) NULL,
    `stockTransferRequestId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InventoryMovement_itemId_movementAt_idx`(`itemId`, `movementAt`),
    INDEX `InventoryMovement_movementType_movementAt_idx`(`movementType`, `movementAt`),
    INDEX `InventoryMovement_locationId_itemId_idx`(`locationId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryLocation` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `address` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isLegacy` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InventoryLocation_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoreManagerAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StoreManagerAssignment_userId_key`(`userId`),
    INDEX `StoreManagerAssignment_storeId_idx`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoreAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `action` ENUM('STORE_CREATED', 'STORE_UPDATED', 'STORE_ACTIVATED', 'STORE_DEACTIVATED', 'MANAGER_ASSIGNED', 'MANAGER_REMOVED') NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `performedByUserId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StoreAuditLog_storeId_createdAt_idx`(`storeId`, `createdAt`),
    INDEX `StoreAuditLog_performedByUserId_idx`(`performedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoreInventoryBalance` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `physicalQty` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `transitQty` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StoreInventoryBalance_locationId_idx`(`locationId`),
    UNIQUE INDEX `StoreInventoryBalance_itemId_locationId_key`(`itemId`, `locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransferRequest` (
    `id` VARCHAR(191) NOT NULL,
    `requestNumber` VARCHAR(191) NOT NULL,
    `sourceLocationId` VARCHAR(191) NOT NULL,
    `destinationLocationId` VARCHAR(191) NOT NULL,
    `requestedByUserId` VARCHAR(191) NOT NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED_IN_TRANSIT', 'COMPLETED', 'REJECTED', 'RECEIPT_REJECTED', 'PENDING_CORRECTION') NOT NULL DEFAULT 'PENDING',
    `rejectionReason` TEXT NULL,
    `notes` TEXT NULL,
    `approvedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `receiptRejectionReason` TEXT NULL,
    `receiptRejectedByUserId` VARCHAR(191) NULL,
    `receiptRejectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockTransferRequest_requestNumber_key`(`requestNumber`),
    INDEX `StockTransferRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `StockTransferRequest_sourceLocationId_idx`(`sourceLocationId`),
    INDEX `StockTransferRequest_destinationLocationId_idx`(`destinationLocationId`),
    INDEX `StockTransferRequest_requestedByUserId_idx`(`requestedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransferItem` (
    `id` VARCHAR(191) NOT NULL,
    `transferId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `qtyRequested` DECIMAL(12, 3) NOT NULL,
    `qtyIssued` DECIMAL(12, 3) NULL,
    `partialIssueReason` TEXT NULL,
    `qtyReceived` DECIMAL(12, 3) NULL,
    `discrepancyNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockTransferItem_transferId_idx`(`transferId`),
    INDEX `StockTransferItem_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransferDiscrepancy` (
    `id` VARCHAR(191) NOT NULL,
    `transferId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `qtyIssued` DECIMAL(12, 3) NOT NULL,
    `qtyReceived` DECIMAL(12, 3) NOT NULL,
    `qtyShort` DECIMAL(12, 3) NOT NULL,
    `notedByUserId` VARCHAR(191) NULL,
    `notedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockTransferDiscrepancy_transferId_idx`(`transferId`),
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
    `businessRegistrationNo` VARCHAR(191) NULL,
    `taxPin` VARCHAR(191) NULL,
    `vatNumber` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccountNo` VARCHAR(191) NULL,
    `bankBranch` VARCHAR(191) NULL,
    `bankSwiftCode` VARCHAR(191) NULL,
    `onboardingStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `onboardingNotes` TEXT NULL,
    `qaApprovedAt` DATETIME(3) NULL,
    `financeApprovedAt` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'LOCKED') NOT NULL DEFAULT 'INACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Supplier_code_key`(`code`),
    INDEX `Supplier_code_idx`(`code`),
    INDEX `Supplier_name_idx`(`name`),
    INDEX `Supplier_onboardingStatus_idx`(`onboardingStatus`),
    INDEX `Supplier_status_idx`(`status`),
    INDEX `Supplier_taxPin_idx`(`taxPin`),
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
    `purchaseOrderId` VARCHAR(191) NULL,

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
    `wasteLoss` DECIMAL(12, 3) NOT NULL,
    `efficiency` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductionBatch_batchNumber_key`(`batchNumber`),
    INDEX `ProductionBatch_batchNumber_idx`(`batchNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionBatchOutput` (
    `id` VARCHAR(191) NOT NULL,
    `productionBatchId` VARCHAR(191) NOT NULL,
    `inventoryItemId` VARCHAR(191) NOT NULL,
    `quantityKg` DECIMAL(12, 3) NOT NULL,

    INDEX `ProductionBatchOutput_productionBatchId_idx`(`productionBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackagingRun` (
    `id` VARCHAR(191) NOT NULL,
    `runNumber` VARCHAR(191) NOT NULL,
    `operatorName` VARCHAR(191) NOT NULL,
    `baleWeightKg` DECIMAL(12, 3) NOT NULL DEFAULT 24,
    `flourSpillage` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `packagingMaterialReceived` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `packagingMaterialConsumed` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `packagingMaterialDestroyed` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `totalPackagedKg` DECIMAL(12, 3) NOT NULL,
    `yieldPercent` DECIMAL(5, 2) NOT NULL,
    `electricityKwh` DECIMAL(10, 3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PackagingRun_runNumber_key`(`runNumber`),
    INDEX `PackagingRun_runNumber_idx`(`runNumber`),
    INDEX `PackagingRun_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackagingRunFinishedProductInput` (
    `id` VARCHAR(191) NOT NULL,
    `packagingRunId` VARCHAR(191) NOT NULL,
    `inventoryItemId` VARCHAR(191) NOT NULL,
    `finishedProductName` VARCHAR(255) NOT NULL,
    `flourConsumedKg` DECIMAL(12, 3) NOT NULL,
    `flourSpillageKg` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PackagingRunFinishedProductInput_packagingRunId_idx`(`packagingRunId`),
    INDEX `PackagingRunFinishedProductInput_finishedProductName_idx`(`finishedProductName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackagingRunFinishedProductOutput` (
    `id` VARCHAR(191) NOT NULL,
    `packagingRunId` VARCHAR(191) NOT NULL,
    `finishedProductName` VARCHAR(255) NOT NULL,
    `typeKey` VARCHAR(191) NULL DEFAULT 'UNKNOWN',
    `inventoryItemId` VARCHAR(191) NULL,
    `balesProduced` INTEGER NOT NULL,
    `packagedKg` DECIMAL(12, 3) NOT NULL,
    `kgPerUnit` DECIMAL(12, 3) NOT NULL DEFAULT 24,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PackagingRunFinishedProductOutput_packagingRunId_idx`(`packagingRunId`),
    INDEX `PackagingRunFinishedProductOutput_finishedProductName_idx`(`finishedProductName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `type` ENUM('DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'WALK_IN') NOT NULL DEFAULT 'RETAILER',
    `creditLimit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `currentBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `creditDays` INTEGER NOT NULL DEFAULT 30,
    `taxPin` VARCHAR(32) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_email_key`(`email`),
    INDEX `Customer_type_idx`(`type`),
    INDEX `Customer_status_idx`(`status`),
    INDEX `Customer_currentBalance_idx`(`currentBalance`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesProduct` (
    `id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `basePrice` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'bag',
    `category` VARCHAR(64) NOT NULL DEFAULT 'FLOUR',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalesProduct_sku_key`(`sku`),
    INDEX `SalesProduct_sku_idx`(`sku`),
    INDEX `SalesProduct_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesOrder` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `taxAmount` DECIMAL(12, 2) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `paymentStatus` ENUM('PENDING', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'PENDING',
    `orderStatus` ENUM('DRAFT', 'CONFIRMED', 'CANCELLED', 'FULFILLED') NOT NULL DEFAULT 'DRAFT',
    `dispatchStatus` ENUM('PENDING', 'LOADING', 'DISPATCHED', 'DELIVERED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalesOrder_orderNumber_key`(`orderNumber`),
    INDEX `SalesOrder_customerId_idx`(`customerId`),
    INDEX `SalesOrder_orderStatus_idx`(`orderStatus`),
    INDEX `SalesOrder_paymentStatus_idx`(`paymentStatus`),
    INDEX `SalesOrder_dispatchStatus_idx`(`dispatchStatus`),
    INDEX `SalesOrder_orderDate_idx`(`orderDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `salesOrderId` VARCHAR(191) NOT NULL,
    `productSku` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SalesOrderItem_salesOrderId_idx`(`salesOrderId`),
    INDEX `SalesOrderItem_productSku_idx`(`productSku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `tax` DECIMAL(10, 2) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `amountDue` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID', 'OVERDUE') NOT NULL DEFAULT 'DRAFT',
    `dueDate` DATETIME(3) NULL,
    `issuedAt` DATETIME(3) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `salesOrderId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_invoiceNumber_key`(`invoiceNumber`),
    UNIQUE INDEX `Invoice_salesOrderId_key`(`salesOrderId`),
    INDEX `Invoice_customerId_idx`(`customerId`),
    INDEX `Invoice_status_idx`(`status`),
    INDEX `Invoice_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerPayment` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amountPaid` DECIMAL(12, 2) NOT NULL,
    `paymentMethod` ENUM('MPESA', 'BANK', 'CASH', 'CHEQUE') NOT NULL,
    `transactionReference` VARCHAR(128) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerPayment_customerId_idx`(`customerId`),
    INDEX `CustomerPayment_invoiceId_idx`(`invoiceId`),
    INDEX `CustomerPayment_paidAt_idx`(`paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierComplianceDocument` (
    `id` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('FOOD_SAFETY', 'KEBS_CERTIFICATE', 'ISO', 'ORGANIC', 'GLOBALGAP', 'TAX_COMPLIANCE', 'OTHER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileUrl` TEXT NULL,
    `referenceNo` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'EXPIRING_SOON', 'NON_COMPLIANT') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupplierComplianceDocument_supplierId_idx`(`supplierId`),
    INDEX `SupplierComplianceDocument_expiresAt_idx`(`expiresAt`),
    INDEX `SupplierComplianceDocument_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementItemProfile` (
    `id` VARCHAR(191) NOT NULL,
    `inventoryItemId` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('RAW_MATERIAL', 'PACKAGING', 'MILLING_CONSUMABLE', 'ENGINEERING_SPARE') NOT NULL,
    `unit` ENUM('KG', 'BAG', 'PIECES', 'BALE', 'UNIT', 'MT', 'GRAMS', 'L') NOT NULL DEFAULT 'KG',
    `description` TEXT NULL,
    `lowStockThreshold` DECIMAL(12, 3) NULL,
    `reorderQuantity` DECIMAL(12, 3) NULL,
    `rawMaizeGrade` ENUM('GRADE_A', 'GRADE_B', 'GRADE_C', 'REJECT') NULL,
    `packagingBagSize` ENUM('KG_1', 'KG_2', 'KG_5', 'KG_10', 'KG_24', 'KG_50') NULL,
    `brandingDesignCode` VARCHAR(191) NULL,
    `moistureMaxPct` DECIMAL(5, 2) NULL,
    `aflatoxinMaxPpb` DECIMAL(8, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProcurementItemProfile_inventoryItemId_key`(`inventoryItemId`),
    UNIQUE INDEX `ProcurementItemProfile_sku_key`(`sku`),
    INDEX `ProcurementItemProfile_category_idx`(`category`),
    INDEX `ProcurementItemProfile_sku_idx`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierSuppliedItem` (
    `id` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `itemProfileId` VARCHAR(191) NOT NULL,
    `isPreferred` BOOLEAN NOT NULL DEFAULT false,
    `leadTimeDays` INTEGER NULL,
    `minOrderQty` DECIMAL(12, 3) NULL,
    `lastUnitPrice` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupplierSuppliedItem_supplierId_idx`(`supplierId`),
    INDEX `SupplierSuppliedItem_itemProfileId_idx`(`itemProfileId`),
    UNIQUE INDEX `SupplierSuppliedItem_supplierId_itemProfileId_key`(`supplierId`, `itemProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalThreshold` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `headProcurementMax` DECIMAL(14, 2) NOT NULL,
    `financeDirectorMin` DECIMAL(14, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseRequisition` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionNo` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `source` ENUM('LOW_STOCK_AUTO', 'MANUAL_PLANT', 'MANUAL_PROCUREMENT') NOT NULL DEFAULT 'MANUAL_PROCUREMENT',
    `status` ENUM('DRAFT', 'PENDING_HEAD_PROCUREMENT', 'PENDING_FINANCE', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `justification` TEXT NULL,
    `requiredByDate` DATETIME(3) NULL,
    `estimatedTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `rejectionReason` TEXT NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseRequisition_requisitionNo_key`(`requisitionNo`),
    INDEX `PurchaseRequisition_requisitionNo_idx`(`requisitionNo`),
    INDEX `PurchaseRequisition_status_idx`(`status`),
    INDEX `PurchaseRequisition_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseRequisitionLine` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NOT NULL,
    `itemProfileId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitPriceEstimate` DECIMAL(12, 2) NULL,
    `lineTotalEstimate` DECIMAL(14, 2) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PurchaseRequisitionLine_requisitionId_idx`(`requisitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementApproval` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `approverName` VARCHAR(191) NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `comments` TEXT NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requisitionId` VARCHAR(191) NULL,
    `purchaseOrderId` VARCHAR(191) NULL,

    INDEX `ProcurementApproval_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `ProcurementApproval_requisitionId_idx`(`requisitionId`),
    INDEX `ProcurementApproval_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` VARCHAR(191) NOT NULL,
    `poNumber` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `exchangeRate` DECIMAL(12, 6) NOT NULL DEFAULT 1,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 16,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `termsAndConditions` TEXT NULL,
    `expectedDelivery` DATETIME(3) NULL,
    `issuedAt` DATETIME(3) NULL,
    `issuedBy` VARCHAR(191) NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_poNumber_key`(`poNumber`),
    INDEX `PurchaseOrder_poNumber_idx`(`poNumber`),
    INDEX `PurchaseOrder_supplierId_idx`(`supplierId`),
    INDEX `PurchaseOrder_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderLine` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `itemProfileId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(14, 2) NOT NULL,
    `quantityReceived` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PurchaseOrderLine_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeighbridgeTicket` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL DEFAULT 'INBOUND',
    `purchaseOrderId` VARCHAR(191) NULL,
    `rawMaizeBatchId` VARCHAR(191) NULL,
    `truckRegistration` VARCHAR(191) NOT NULL,
    `driverName` VARCHAR(191) NULL,
    `grossWeightKg` DECIMAL(12, 3) NOT NULL,
    `tareWeightKg` DECIMAL(12, 3) NOT NULL,
    `netWeightKg` DECIMAL(12, 3) NOT NULL,
    `weighedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `weighedOutAt` DATETIME(3) NULL,
    `operatorName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WeighbridgeTicket_ticketNumber_key`(`ticketNumber`),
    INDEX `WeighbridgeTicket_ticketNumber_idx`(`ticketNumber`),
    INDEX `WeighbridgeTicket_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementQCLabResult` (
    `id` VARCHAR(191) NOT NULL,
    `qcNumber` VARCHAR(191) NOT NULL,
    `category` ENUM('RAW_MATERIAL', 'PACKAGING', 'MILLING_CONSUMABLE', 'ENGINEERING_SPARE') NOT NULL,
    `weighbridgeTicketId` VARCHAR(191) NULL,
    `rawMaizeBatchId` VARCHAR(191) NULL,
    `grnId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'PASSED', 'FAILED_CONDITIONAL', 'FULL_REJECTION') NOT NULL DEFAULT 'PENDING',
    `testedBy` VARCHAR(191) NOT NULL,
    `testedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `moistureContentPct` DECIMAL(5, 2) NULL,
    `aflatoxinPpb` DECIMAL(8, 2) NULL,
    `rottenBrokenPct` DECIMAL(5, 2) NULL,
    `foreignMatterPct` DECIMAL(5, 2) NULL,
    `liveInsectsCount` INTEGER NULL,
    `assignedGrade` ENUM('GRADE_A', 'GRADE_B', 'GRADE_C', 'REJECT') NULL,
    `tensileStrengthN` DECIMAL(10, 2) NULL,
    `printAlignmentScore` DECIMAL(5, 2) NULL,
    `dimensionAccuracyMm` DECIMAL(8, 2) NULL,
    `priceDeductionPct` DECIMAL(5, 2) NULL,
    `priceDeductionAmount` DECIMAL(14, 2) NULL,
    `acceptedQuantity` DECIMAL(12, 3) NULL,
    `rejectionNote` TEXT NULL,
    `remarks` TEXT NULL,
    `blocksInventoryPost` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProcurementQCLabResult_qcNumber_key`(`qcNumber`),
    INDEX `ProcurementQCLabResult_qcNumber_idx`(`qcNumber`),
    INDEX `ProcurementQCLabResult_status_idx`(`status`),
    INDEX `ProcurementQCLabResult_rawMaizeBatchId_idx`(`rawMaizeBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoodsReceivedNote` (
    `id` VARCHAR(191) NOT NULL,
    `grnNumber` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `weighbridgeTicketId` VARCHAR(191) NULL,
    `deliverySequence` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'PENDING_QC', 'POSTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_QC',
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedBy` VARCHAR(191) NOT NULL,
    `lotNumber` VARCHAR(191) NULL,
    `batchTraceCode` VARCHAR(191) NULL,
    `netWeightAccepted` DECIMAL(12, 3) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GoodsReceivedNote_grnNumber_key`(`grnNumber`),
    INDEX `GoodsReceivedNote_grnNumber_idx`(`grnNumber`),
    INDEX `GoodsReceivedNote_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `GoodsReceivedNote_status_idx`(`status`),
    INDEX `GoodsReceivedNote_lotNumber_idx`(`lotNumber`),
    INDEX `GoodsReceivedNote_batchTraceCode_idx`(`batchTraceCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoodsReceivedNoteLine` (
    `id` VARCHAR(191) NOT NULL,
    `grnId` VARCHAR(191) NOT NULL,
    `purchaseOrderLineId` VARCHAR(191) NOT NULL,
    `quantityAccepted` DECIMAL(12, 3) NOT NULL,
    `quantityRejected` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `unitPriceApplied` DECIMAL(12, 2) NOT NULL,
    `lineTotal` DECIMAL(14, 2) NOT NULL,
    `lotNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GoodsReceivedNoteLine_grnId_idx`(`grnId`),
    INDEX `GoodsReceivedNoteLine_purchaseOrderLineId_idx`(`purchaseOrderLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `taxAmount` DECIMAL(14, 2) NOT NULL,
    `totalAmount` DECIMAL(14, 2) NOT NULL,
    `fileUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupplierInvoice_purchaseOrderId_idx`(`purchaseOrderId`),
    UNIQUE INDEX `SupplierInvoice_supplierId_invoiceNumber_key`(`supplierId`, `invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreeWayMatch` (
    `id` VARCHAR(191) NOT NULL,
    `matchNumber` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `grnId` VARCHAR(191) NOT NULL,
    `supplierInvoiceId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'MATCHED', 'PRICE_DISCREPANCY', 'QUANTITY_DISCREPANCY', 'BOTH_DISCREPANCY', 'APPROVED_FOR_PAYMENT', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `poTotal` DECIMAL(14, 2) NOT NULL,
    `grnTotal` DECIMAL(14, 2) NOT NULL,
    `invoiceTotal` DECIMAL(14, 2) NOT NULL,
    `priceVariancePct` DECIMAL(8, 4) NULL,
    `quantityVariancePct` DECIMAL(8, 4) NULL,
    `tolerancePct` DECIMAL(5, 2) NOT NULL DEFAULT 1,
    `discrepancyNotes` TEXT NULL,
    `matchedAt` DATETIME(3) NULL,
    `matchedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ThreeWayMatch_matchNumber_key`(`matchNumber`),
    INDEX `ThreeWayMatch_matchNumber_idx`(`matchNumber`),
    INDEX `ThreeWayMatch_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `voucherNumber` VARCHAR(191) NOT NULL,
    `threeWayMatchId` VARCHAR(191) NOT NULL,
    `supplierInvoiceId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `status` ENUM('DRAFT', 'APPROVED', 'PAID', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `apQueuePushedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentVoucher_voucherNumber_key`(`voucherNumber`),
    INDEX `PaymentVoucher_voucherNumber_idx`(`voucherNumber`),
    INDEX `PaymentVoucher_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DomainEvent` (
    `id` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `aggregateType` VARCHAR(191) NOT NULL,
    `aggregateId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `publishedAt` DATETIME(3) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DomainEvent_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `DomainEvent_eventType_idx`(`eventType`),
    INDEX `DomainEvent_aggregateType_aggregateId_idx`(`aggregateType`, `aggregateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'STATUS_CHANGE', 'APPROVE', 'REJECT', 'POST', 'VOID') NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `beforeState` JSON NULL,
    `afterState` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supplierId` VARCHAR(191) NULL,

    INDEX `ProcurementAuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `ProcurementAuditLog_createdAt_idx`(`createdAt`),
    INDEX `ProcurementAuditLog_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InventoryPriceHistory` ADD CONSTRAINT `InventoryPriceHistory_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_grnLineId_fkey` FOREIGN KEY (`grnLineId`) REFERENCES `GoodsReceivedNoteLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_packagingRunId_fkey` FOREIGN KEY (`packagingRunId`) REFERENCES `PackagingRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_stockTransferRequestId_fkey` FOREIGN KEY (`stockTransferRequestId`) REFERENCES `StockTransferRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreManagerAssignment` ADD CONSTRAINT `StoreManagerAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreManagerAssignment` ADD CONSTRAINT `StoreManagerAssignment_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `InventoryLocation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreAuditLog` ADD CONSTRAINT `StoreAuditLog_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `InventoryLocation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreInventoryBalance` ADD CONSTRAINT `StoreInventoryBalance_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreInventoryBalance` ADD CONSTRAINT `StoreInventoryBalance_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferRequest` ADD CONSTRAINT `StockTransferRequest_sourceLocationId_fkey` FOREIGN KEY (`sourceLocationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferRequest` ADD CONSTRAINT `StockTransferRequest_destinationLocationId_fkey` FOREIGN KEY (`destinationLocationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferRequest` ADD CONSTRAINT `StockTransferRequest_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferRequest` ADD CONSTRAINT `StockTransferRequest_approvedByUserId_fkey` FOREIGN KEY (`approvedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferRequest` ADD CONSTRAINT `StockTransferRequest_receiptRejectedByUserId_fkey` FOREIGN KEY (`receiptRejectedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferItem` ADD CONSTRAINT `StockTransferItem_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `StockTransferRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferItem` ADD CONSTRAINT `StockTransferItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferDiscrepancy` ADD CONSTRAINT `StockTransferDiscrepancy_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `StockTransferRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `ProductionBatchOutput` ADD CONSTRAINT `ProductionBatchOutput_productionBatchId_fkey` FOREIGN KEY (`productionBatchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatchOutput` ADD CONSTRAINT `ProductionBatchOutput_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackagingRunFinishedProductInput` ADD CONSTRAINT `PackagingRunFinishedProductInput_packagingRunId_fkey` FOREIGN KEY (`packagingRunId`) REFERENCES `PackagingRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackagingRunFinishedProductInput` ADD CONSTRAINT `PackagingRunFinishedProductInput_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackagingRunFinishedProductOutput` ADD CONSTRAINT `PackagingRunFinishedProductOutput_packagingRunId_fkey` FOREIGN KEY (`packagingRunId`) REFERENCES `PackagingRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackagingRunFinishedProductOutput` ADD CONSTRAINT `PackagingRunFinishedProductOutput_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrder` ADD CONSTRAINT `SalesOrder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrderItem` ADD CONSTRAINT `SalesOrderItem_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesOrderItem` ADD CONSTRAINT `SalesOrderItem_productSku_fkey` FOREIGN KEY (`productSku`) REFERENCES `SalesProduct`(`sku`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPayment` ADD CONSTRAINT `CustomerPayment_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPayment` ADD CONSTRAINT `CustomerPayment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierComplianceDocument` ADD CONSTRAINT `SupplierComplianceDocument_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierSuppliedItem` ADD CONSTRAINT `SupplierSuppliedItem_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierSuppliedItem` ADD CONSTRAINT `SupplierSuppliedItem_itemProfileId_fkey` FOREIGN KEY (`itemProfileId`) REFERENCES `ProcurementItemProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisition` ADD CONSTRAINT `PurchaseRequisition_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisitionLine` ADD CONSTRAINT `PurchaseRequisitionLine_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `PurchaseRequisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisitionLine` ADD CONSTRAINT `PurchaseRequisitionLine_itemProfileId_fkey` FOREIGN KEY (`itemProfileId`) REFERENCES `ProcurementItemProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementApproval` ADD CONSTRAINT `ProcurementApproval_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `PurchaseRequisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementApproval` ADD CONSTRAINT `ProcurementApproval_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `PurchaseRequisition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderLine` ADD CONSTRAINT `PurchaseOrderLine_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderLine` ADD CONSTRAINT `PurchaseOrderLine_itemProfileId_fkey` FOREIGN KEY (`itemProfileId`) REFERENCES `ProcurementItemProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeighbridgeTicket` ADD CONSTRAINT `WeighbridgeTicket_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeighbridgeTicket` ADD CONSTRAINT `WeighbridgeTicket_rawMaizeBatchId_fkey` FOREIGN KEY (`rawMaizeBatchId`) REFERENCES `RawMaizeBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementQCLabResult` ADD CONSTRAINT `ProcurementQCLabResult_weighbridgeTicketId_fkey` FOREIGN KEY (`weighbridgeTicketId`) REFERENCES `WeighbridgeTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementQCLabResult` ADD CONSTRAINT `ProcurementQCLabResult_rawMaizeBatchId_fkey` FOREIGN KEY (`rawMaizeBatchId`) REFERENCES `RawMaizeBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementQCLabResult` ADD CONSTRAINT `ProcurementQCLabResult_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceivedNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivedNote` ADD CONSTRAINT `GoodsReceivedNote_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivedNote` ADD CONSTRAINT `GoodsReceivedNote_weighbridgeTicketId_fkey` FOREIGN KEY (`weighbridgeTicketId`) REFERENCES `WeighbridgeTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivedNoteLine` ADD CONSTRAINT `GoodsReceivedNoteLine_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceivedNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivedNoteLine` ADD CONSTRAINT `GoodsReceivedNoteLine_purchaseOrderLineId_fkey` FOREIGN KEY (`purchaseOrderLineId`) REFERENCES `PurchaseOrderLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierInvoice` ADD CONSTRAINT `SupplierInvoice_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierInvoice` ADD CONSTRAINT `SupplierInvoice_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreeWayMatch` ADD CONSTRAINT `ThreeWayMatch_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceivedNote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreeWayMatch` ADD CONSTRAINT `ThreeWayMatch_supplierInvoiceId_fkey` FOREIGN KEY (`supplierInvoiceId`) REFERENCES `SupplierInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentVoucher` ADD CONSTRAINT `PaymentVoucher_threeWayMatchId_fkey` FOREIGN KEY (`threeWayMatchId`) REFERENCES `ThreeWayMatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentVoucher` ADD CONSTRAINT `PaymentVoucher_supplierInvoiceId_fkey` FOREIGN KEY (`supplierInvoiceId`) REFERENCES `SupplierInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementAuditLog` ADD CONSTRAINT `ProcurementAuditLog_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
