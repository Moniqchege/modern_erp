-- AlterTable
ALTER TABLE `stocktransferrequest` ADD COLUMN `receiptRejectedAt` DATETIME(3) NULL,
    ADD COLUMN `receiptRejectedByUserId` VARCHAR(191) NULL,
    ADD COLUMN `receiptRejectionReason` TEXT NULL,
    MODIFY `status` ENUM('PENDING', 'APPROVED_IN_TRANSIT', 'COMPLETED', 'REJECTED', 'RECEIPT_REJECTED', 'PENDING_CORRECTION') NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE `StockTransferRequest` ADD CONSTRAINT `StockTransferRequest_receiptRejectedByUserId_fkey` FOREIGN KEY (`receiptRejectedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
