-- AlterTable: Add receipt rejection fields to StockTransferRequest
ALTER TABLE `StockTransferRequest` 
  ADD COLUMN `receiptRejectionReason` TEXT NULL,
  ADD COLUMN `receiptRejectedByUserId` VARCHAR(191) NULL,
  ADD COLUMN `receiptRejectedAt` DATETIME(3) NULL;

-- AlterEnum: Add new statuses to StockTransferStatus
ALTER TABLE `StockTransferRequest` 
  MODIFY COLUMN `status` ENUM('PENDING', 'APPROVED_IN_TRANSIT', 'COMPLETED', 'REJECTED', 'RECEIPT_REJECTED', 'PENDING_CORRECTION') NOT NULL DEFAULT 'PENDING';

-- AddForeignKey: Link receiptRejectedBy to User
ALTER TABLE `StockTransferRequest` 
  ADD CONSTRAINT `StockTransferRequest_receiptRejectedByUserId_fkey` 
  FOREIGN KEY (`receiptRejectedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
