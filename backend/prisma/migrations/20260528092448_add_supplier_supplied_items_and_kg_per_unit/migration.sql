-- AlterTable
ALTER TABLE `packagingrunfinishedproductoutput` ADD COLUMN `kgPerUnit` DECIMAL(12, 3) NOT NULL DEFAULT 24;

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

-- AddForeignKey
ALTER TABLE `SupplierSuppliedItem` ADD CONSTRAINT `SupplierSuppliedItem_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierSuppliedItem` ADD CONSTRAINT `SupplierSuppliedItem_itemProfileId_fkey` FOREIGN KEY (`itemProfileId`) REFERENCES `ProcurementItemProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
