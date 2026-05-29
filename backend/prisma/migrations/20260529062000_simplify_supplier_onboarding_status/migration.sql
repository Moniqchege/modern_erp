/*
  Warnings:

  - You are about to alter the column `onboardingStatus` on the `supplier` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(33))` to `Enum(EnumId(7))`.

*/
-- AlterTable
ALTER TABLE `supplier` MODIFY `onboardingStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING';
