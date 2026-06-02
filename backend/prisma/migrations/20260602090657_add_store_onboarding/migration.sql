/*
  Warnings:

  - You are about to alter the column `code` on the `inventorylocation` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `VarChar(191)`.

*/
-- AlterTable
ALTER TABLE `inventorylocation` ADD COLUMN `address` VARCHAR(500) NULL,
    ADD COLUMN `description` VARCHAR(1000) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `isLegacy` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `name` VARCHAR(255) NOT NULL;

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

-- AddForeignKey
ALTER TABLE `StoreManagerAssignment` ADD CONSTRAINT `StoreManagerAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreManagerAssignment` ADD CONSTRAINT `StoreManagerAssignment_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `InventoryLocation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreAuditLog` ADD CONSTRAINT `StoreAuditLog_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `InventoryLocation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
