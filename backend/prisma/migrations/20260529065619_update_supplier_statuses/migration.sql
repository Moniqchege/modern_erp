/*
  Warnings:

  - You are about to drop the column `isActive` on the `supplier` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `supplier` DROP COLUMN `isActive`,
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'LOCKED') NOT NULL DEFAULT 'INACTIVE';
