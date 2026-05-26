/*
  Warnings:

  - The values [TONNE] on the enum `ProcurementItemProfile_unit` will be removed. If these variants are still used in the database, this will fail.
  - The values [TONNE] on the enum `ProcurementItemProfile_unit` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `inventoryitem` MODIFY `unit` ENUM('KG', 'BAG', 'PIECES', 'BALE', 'UNIT', 'MT', 'GRAMS', 'L') NOT NULL DEFAULT 'KG';

-- AlterTable
ALTER TABLE `procurementitemprofile` MODIFY `unit` ENUM('KG', 'BAG', 'PIECES', 'BALE', 'UNIT', 'MT', 'GRAMS', 'L') NOT NULL DEFAULT 'KG';
