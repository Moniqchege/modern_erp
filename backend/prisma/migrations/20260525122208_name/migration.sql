/*
  Warnings:

  - Added the required column `priceType` to the `InventoryPriceHistory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
-- NOTE: MySQL cannot drop this index while it is referenced by a foreign key constraint.
-- The rest of the migration (adding required columns/indexes) is sufficient; skipping this drop
-- avoids error 1553.


-- AlterTable
ALTER TABLE `inventoryitem` MODIFY `type` ENUM('RAW_MATERIAL', 'FINISHED_GOOD', 'BY_PRODUCT', 'PACKETS_2KG', 'PACKETS_1KG', 'KHAKI_BALER_2KG', 'KHAKI_BALER_1KG', 'NYLON_BALER_1KG', 'NYLON_BALER_2KG', 'BAG_5KG', 'BAG_10KG', 'LAMINATED_BALER', 'BAG_50KG', 'BAG_90KG', 'CLEAR_TAPES', 'GLUE') NOT NULL DEFAULT 'FINISHED_GOOD';

-- AlterTable
ALTER TABLE `inventorymovement` ADD COLUMN `locationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `inventorypricehistory` ADD COLUMN `priceType` ENUM('BUYING', 'SELLING') NOT NULL;

-- CreateTable
CREATE TABLE `InventoryLocation` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InventoryLocation_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `InventoryPriceHistory_itemId_priceType_effectiveDate_idx` ON `InventoryPriceHistory`(`itemId`, `priceType`, `effectiveDate`);

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
