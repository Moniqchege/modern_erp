/*
  Warnings:

  - You are about to drop the column `packetKg` on the `packagingrunfinishedproductoutput` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `packagingrunfinishedproductoutput` DROP FOREIGN KEY `PackagingRunFinishedProductOutput_inventoryItemId_fkey`;

-- AlterTable
ALTER TABLE `packagingrunfinishedproductoutput` DROP COLUMN `packetKg`,
    ADD COLUMN `typeKey` VARCHAR(191) NULL,
    MODIFY `inventoryItemId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `PackagingRunFinishedProductOutput` ADD CONSTRAINT `PackagingRunFinishedProductOutput_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
