/*
  Warnings:

  - You are about to alter the column `code` on the `inventorylocation` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(5))`.

*/
-- AlterTable
ALTER TABLE `inventorylocation` MODIFY `code` ENUM('MAIN_STORE', 'PACKAGING_STORE', 'MAIZE_STORE', 'DISPATCH_STORE') NOT NULL;

-- AlterTable
ALTER TABLE `inventorymovement` ADD COLUMN `stockTransferRequestId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('ADMIN', 'SUPERADMIN', 'MAIN_STORE_MANAGER', 'MAIZE_STORE_MANAGER', 'PACKAGING_STORE_MANAGER', 'DISPATCH_STORE_MANAGER', 'MANAGER', 'EMPLOYEE', 'QC_INSPECTOR', 'WAREHOUSE_OPERATOR', 'PROCUREMENT_OFFICER', 'FINANCE_DIRECTOR', 'LAB_TECHNICIAN', 'WEIGHBRIDGE_OPERATOR') NOT NULL DEFAULT 'EMPLOYEE';

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
    `status` ENUM('PENDING', 'APPROVED_IN_TRANSIT', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejectionReason` TEXT NULL,
    `notes` TEXT NULL,
    `approvedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
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

-- CreateIndex
CREATE INDEX `InventoryMovement_locationId_itemId_idx` ON `InventoryMovement`(`locationId`, `itemId`);

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_stockTransferRequestId_fkey` FOREIGN KEY (`stockTransferRequestId`) REFERENCES `StockTransferRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE `StockTransferItem` ADD CONSTRAINT `StockTransferItem_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `StockTransferRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferItem` ADD CONSTRAINT `StockTransferItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferDiscrepancy` ADD CONSTRAINT `StockTransferDiscrepancy_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `StockTransferRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
