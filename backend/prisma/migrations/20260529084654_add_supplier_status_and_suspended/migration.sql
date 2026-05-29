-- AlterTable
ALTER TABLE `supplier` MODIFY `onboardingStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX `Supplier_status_idx` ON `Supplier`(`status`);
