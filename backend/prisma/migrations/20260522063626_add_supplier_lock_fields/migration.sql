-- AlterTable
ALTER TABLE `supplier` ADD COLUMN `lockedAt` DATETIME(3) NULL,
    ADD COLUMN `lockedBy` VARCHAR(191) NULL;
