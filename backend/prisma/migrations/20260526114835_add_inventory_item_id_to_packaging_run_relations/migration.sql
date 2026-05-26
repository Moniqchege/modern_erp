/*
  Warnings:

  - Added the required column `inventoryItemId` to the `PackagingRunFinishedProductInput` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inventoryItemId` to the `PackagingRunFinishedProductOutput` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `packagingrunfinishedproductinput` ADD COLUMN `inventoryItemId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `packagingrunfinishedproductoutput` ADD COLUMN `inventoryItemId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `PackagingRunFinishedProductInput` ADD CONSTRAINT `PackagingRunFinishedProductInput_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackagingRunFinishedProductOutput` ADD CONSTRAINT `PackagingRunFinishedProductOutput_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `InventoryItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
