-- AlterTable
ALTER TABLE `inventorymovement` ADD COLUMN `grnLineId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `rawmaizebatch` ADD COLUMN `purchaseOrderId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `supplier` ADD COLUMN `activatedAt` DATETIME(3) NULL,
    ADD COLUMN `bankAccountNo` VARCHAR(191) NULL,
    ADD COLUMN `bankBranch` VARCHAR(191) NULL,
    ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `bankSwiftCode` VARCHAR(191) NULL,
    ADD COLUMN `businessRegistrationNo` VARCHAR(191) NULL,
    ADD COLUMN `financeApprovedAt` DATETIME(3) NULL,
    ADD COLUMN `onboardingNotes` TEXT NULL,
    ADD COLUMN `onboardingStatus` ENUM('DRAFT', 'QA_AUDIT', 'FINANCE_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `qaApprovedAt` DATETIME(3) NULL,
    ADD COLUMN `taxPin` VARCHAR(191) NULL,
    ADD COLUMN `vatNumber` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('ADMIN', 'MANAGER', 'EMPLOYEE', 'QC_INSPECTOR', 'WAREHOUSE_OPERATOR', 'PROCUREMENT_OFFICER', 'FINANCE_DIRECTOR', 'LAB_TECHNICIAN', 'WEIGHBRIDGE_OPERATOR') NOT NULL DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE `SupplierComplianceDocument` (
    `id` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('FOOD_SAFETY', 'KEBS_CERTIFICATE', 'ISO', 'ORGANIC', 'GLOBALGAP', 'TAX_COMPLIANCE', 'OTHER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileUrl` TEXT NULL,
    `referenceNo` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'EXPIRING_SOON', 'NON_COMPLIANT') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupplierComplianceDocument_supplierId_idx`(`supplierId`),
    INDEX `SupplierComplianceDocument_expiresAt_idx`(`expiresAt`),
    INDEX `SupplierComplianceDocument_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementItemProfile` (
    `id` VARCHAR(191) NOT NULL,
    `inventoryItemId` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` ENUM('RAW_MATERIAL', 'PACKAGING', 'MILLING_CONSUMABLE', 'ENGINEERING_SPARE') NOT NULL,
    `unit` ENUM('KG', 'BAG', 'TONNE') NOT NULL DEFAULT 'KG',
    `description` TEXT NULL,
    `lowStockThreshold` DECIMAL(12, 3) NULL,
    `reorderQuantity` DECIMAL(12, 3) NULL,
    `rawMaizeGrade` ENUM('GRADE_A', 'GRADE_B', 'GRADE_C', 'REJECT') NULL,
    `packagingBagSize` ENUM('KG_1', 'KG_2', 'KG_5', 'KG_10', 'KG_24', 'KG_50') NULL,
    `brandingDesignCode` VARCHAR(191) NULL,
    `moistureMaxPct` DECIMAL(5, 2) NULL,
    `aflatoxinMaxPpb` DECIMAL(8, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProcurementItemProfile_inventoryItemId_key`(`inventoryItemId`),
    UNIQUE INDEX `ProcurementItemProfile_sku_key`(`sku`),
    INDEX `ProcurementItemProfile_category_idx`(`category`),
    INDEX `ProcurementItemProfile_sku_idx`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalThreshold` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `headProcurementMax` DECIMAL(14, 2) NOT NULL,
    `financeDirectorMin` DECIMAL(14, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseRequisition` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionNo` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `source` ENUM('LOW_STOCK_AUTO', 'MANUAL_PLANT', 'MANUAL_PROCUREMENT') NOT NULL DEFAULT 'MANUAL_PROCUREMENT',
    `status` ENUM('DRAFT', 'PENDING_HEAD_PROCUREMENT', 'PENDING_FINANCE', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `justification` TEXT NULL,
    `requiredByDate` DATETIME(3) NULL,
    `estimatedTotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `rejectionReason` TEXT NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseRequisition_requisitionNo_key`(`requisitionNo`),
    INDEX `PurchaseRequisition_requisitionNo_idx`(`requisitionNo`),
    INDEX `PurchaseRequisition_status_idx`(`status`),
    INDEX `PurchaseRequisition_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseRequisitionLine` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NOT NULL,
    `itemProfileId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitPriceEstimate` DECIMAL(12, 2) NULL,
    `lineTotalEstimate` DECIMAL(14, 2) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PurchaseRequisitionLine_requisitionId_idx`(`requisitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementApproval` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `approverName` VARCHAR(191) NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `comments` TEXT NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requisitionId` VARCHAR(191) NULL,
    `purchaseOrderId` VARCHAR(191) NULL,

    INDEX `ProcurementApproval_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `ProcurementApproval_requisitionId_idx`(`requisitionId`),
    INDEX `ProcurementApproval_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` VARCHAR(191) NOT NULL,
    `poNumber` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `exchangeRate` DECIMAL(12, 6) NOT NULL DEFAULT 1,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 16,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `termsAndConditions` TEXT NULL,
    `expectedDelivery` DATETIME(3) NULL,
    `issuedAt` DATETIME(3) NULL,
    `issuedBy` VARCHAR(191) NULL,
    `pdfUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_poNumber_key`(`poNumber`),
    INDEX `PurchaseOrder_poNumber_idx`(`poNumber`),
    INDEX `PurchaseOrder_supplierId_idx`(`supplierId`),
    INDEX `PurchaseOrder_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderLine` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `itemProfileId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(14, 2) NOT NULL,
    `quantityReceived` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PurchaseOrderLine_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeighbridgeTicket` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL DEFAULT 'INBOUND',
    `purchaseOrderId` VARCHAR(191) NULL,
    `rawMaizeBatchId` VARCHAR(191) NULL,
    `truckRegistration` VARCHAR(191) NOT NULL,
    `driverName` VARCHAR(191) NULL,
    `grossWeightKg` DECIMAL(12, 3) NOT NULL,
    `tareWeightKg` DECIMAL(12, 3) NOT NULL,
    `netWeightKg` DECIMAL(12, 3) NOT NULL,
    `weighedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `weighedOutAt` DATETIME(3) NULL,
    `operatorName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WeighbridgeTicket_ticketNumber_key`(`ticketNumber`),
    INDEX `WeighbridgeTicket_ticketNumber_idx`(`ticketNumber`),
    INDEX `WeighbridgeTicket_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementQCLabResult` (
    `id` VARCHAR(191) NOT NULL,
    `qcNumber` VARCHAR(191) NOT NULL,
    `category` ENUM('RAW_MATERIAL', 'PACKAGING', 'MILLING_CONSUMABLE', 'ENGINEERING_SPARE') NOT NULL,
    `weighbridgeTicketId` VARCHAR(191) NULL,
    `rawMaizeBatchId` VARCHAR(191) NULL,
    `grnId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'PASSED', 'FAILED_CONDITIONAL', 'FULL_REJECTION') NOT NULL DEFAULT 'PENDING',
    `testedBy` VARCHAR(191) NOT NULL,
    `testedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `moistureContentPct` DECIMAL(5, 2) NULL,
    `aflatoxinPpb` DECIMAL(8, 2) NULL,
    `rottenBrokenPct` DECIMAL(5, 2) NULL,
    `foreignMatterPct` DECIMAL(5, 2) NULL,
    `liveInsectsCount` INTEGER NULL,
    `assignedGrade` ENUM('GRADE_A', 'GRADE_B', 'GRADE_C', 'REJECT') NULL,
    `tensileStrengthN` DECIMAL(10, 2) NULL,
    `printAlignmentScore` DECIMAL(5, 2) NULL,
    `dimensionAccuracyMm` DECIMAL(8, 2) NULL,
    `priceDeductionPct` DECIMAL(5, 2) NULL,
    `priceDeductionAmount` DECIMAL(14, 2) NULL,
    `acceptedQuantity` DECIMAL(12, 3) NULL,
    `rejectionNote` TEXT NULL,
    `remarks` TEXT NULL,
    `blocksInventoryPost` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProcurementQCLabResult_qcNumber_key`(`qcNumber`),
    INDEX `ProcurementQCLabResult_qcNumber_idx`(`qcNumber`),
    INDEX `ProcurementQCLabResult_status_idx`(`status`),
    INDEX `ProcurementQCLabResult_rawMaizeBatchId_idx`(`rawMaizeBatchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoodsReceivedNote` (
    `id` VARCHAR(191) NOT NULL,
    `grnNumber` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `weighbridgeTicketId` VARCHAR(191) NULL,
    `deliverySequence` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'PENDING_QC', 'POSTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_QC',
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedBy` VARCHAR(191) NOT NULL,
    `lotNumber` VARCHAR(191) NULL,
    `batchTraceCode` VARCHAR(191) NULL,
    `netWeightAccepted` DECIMAL(12, 3) NULL,
    `postedAt` DATETIME(3) NULL,
    `postedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GoodsReceivedNote_grnNumber_key`(`grnNumber`),
    INDEX `GoodsReceivedNote_grnNumber_idx`(`grnNumber`),
    INDEX `GoodsReceivedNote_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `GoodsReceivedNote_status_idx`(`status`),
    INDEX `GoodsReceivedNote_lotNumber_idx`(`lotNumber`),
    INDEX `GoodsReceivedNote_batchTraceCode_idx`(`batchTraceCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoodsReceivedNoteLine` (
    `id` VARCHAR(191) NOT NULL,
    `grnId` VARCHAR(191) NOT NULL,
    `purchaseOrderLineId` VARCHAR(191) NOT NULL,
    `quantityAccepted` DECIMAL(12, 3) NOT NULL,
    `quantityRejected` DECIMAL(12, 3) NOT NULL DEFAULT 0,
    `unitPriceApplied` DECIMAL(12, 2) NOT NULL,
    `lineTotal` DECIMAL(14, 2) NOT NULL,
    `lotNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GoodsReceivedNoteLine_grnId_idx`(`grnId`),
    INDEX `GoodsReceivedNoteLine_purchaseOrderLineId_idx`(`purchaseOrderLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `taxAmount` DECIMAL(14, 2) NOT NULL,
    `totalAmount` DECIMAL(14, 2) NOT NULL,
    `fileUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupplierInvoice_purchaseOrderId_idx`(`purchaseOrderId`),
    UNIQUE INDEX `SupplierInvoice_supplierId_invoiceNumber_key`(`supplierId`, `invoiceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ThreeWayMatch` (
    `id` VARCHAR(191) NOT NULL,
    `matchNumber` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `grnId` VARCHAR(191) NOT NULL,
    `supplierInvoiceId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'MATCHED', 'PRICE_DISCREPANCY', 'QUANTITY_DISCREPANCY', 'BOTH_DISCREPANCY', 'APPROVED_FOR_PAYMENT', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `poTotal` DECIMAL(14, 2) NOT NULL,
    `grnTotal` DECIMAL(14, 2) NOT NULL,
    `invoiceTotal` DECIMAL(14, 2) NOT NULL,
    `priceVariancePct` DECIMAL(8, 4) NULL,
    `quantityVariancePct` DECIMAL(8, 4) NULL,
    `tolerancePct` DECIMAL(5, 2) NOT NULL DEFAULT 1,
    `discrepancyNotes` TEXT NULL,
    `matchedAt` DATETIME(3) NULL,
    `matchedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ThreeWayMatch_matchNumber_key`(`matchNumber`),
    INDEX `ThreeWayMatch_matchNumber_idx`(`matchNumber`),
    INDEX `ThreeWayMatch_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `voucherNumber` VARCHAR(191) NOT NULL,
    `threeWayMatchId` VARCHAR(191) NOT NULL,
    `supplierInvoiceId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `currency` ENUM('KES', 'USD', 'EUR', 'UGX', 'TZS') NOT NULL DEFAULT 'KES',
    `status` ENUM('DRAFT', 'APPROVED', 'PAID', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `apQueuePushedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentVoucher_voucherNumber_key`(`voucherNumber`),
    INDEX `PaymentVoucher_voucherNumber_idx`(`voucherNumber`),
    INDEX `PaymentVoucher_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DomainEvent` (
    `id` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `aggregateType` VARCHAR(191) NOT NULL,
    `aggregateId` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PUBLISHED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `publishedAt` DATETIME(3) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DomainEvent_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `DomainEvent_eventType_idx`(`eventType`),
    INDEX `DomainEvent_aggregateType_aggregateId_idx`(`aggregateType`, `aggregateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcurementAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'STATUS_CHANGE', 'APPROVE', 'REJECT', 'POST', 'VOID') NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `beforeState` JSON NULL,
    `afterState` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supplierId` VARCHAR(191) NULL,

    INDEX `ProcurementAuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `ProcurementAuditLog_createdAt_idx`(`createdAt`),
    INDEX `ProcurementAuditLog_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Supplier_onboardingStatus_idx` ON `Supplier`(`onboardingStatus`);

-- CreateIndex
CREATE INDEX `Supplier_taxPin_idx` ON `Supplier`(`taxPin`);

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_grnLineId_fkey` FOREIGN KEY (`grnLineId`) REFERENCES `GoodsReceivedNoteLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierComplianceDocument` ADD CONSTRAINT `SupplierComplianceDocument_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisition` ADD CONSTRAINT `PurchaseRequisition_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisitionLine` ADD CONSTRAINT `PurchaseRequisitionLine_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `PurchaseRequisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisitionLine` ADD CONSTRAINT `PurchaseRequisitionLine_itemProfileId_fkey` FOREIGN KEY (`itemProfileId`) REFERENCES `ProcurementItemProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementApproval` ADD CONSTRAINT `ProcurementApproval_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `PurchaseRequisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementApproval` ADD CONSTRAINT `ProcurementApproval_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `PurchaseRequisition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderLine` ADD CONSTRAINT `PurchaseOrderLine_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderLine` ADD CONSTRAINT `PurchaseOrderLine_itemProfileId_fkey` FOREIGN KEY (`itemProfileId`) REFERENCES `ProcurementItemProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeighbridgeTicket` ADD CONSTRAINT `WeighbridgeTicket_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeighbridgeTicket` ADD CONSTRAINT `WeighbridgeTicket_rawMaizeBatchId_fkey` FOREIGN KEY (`rawMaizeBatchId`) REFERENCES `RawMaizeBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementQCLabResult` ADD CONSTRAINT `ProcurementQCLabResult_weighbridgeTicketId_fkey` FOREIGN KEY (`weighbridgeTicketId`) REFERENCES `WeighbridgeTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementQCLabResult` ADD CONSTRAINT `ProcurementQCLabResult_rawMaizeBatchId_fkey` FOREIGN KEY (`rawMaizeBatchId`) REFERENCES `RawMaizeBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementQCLabResult` ADD CONSTRAINT `ProcurementQCLabResult_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceivedNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivedNote` ADD CONSTRAINT `GoodsReceivedNote_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivedNote` ADD CONSTRAINT `GoodsReceivedNote_weighbridgeTicketId_fkey` FOREIGN KEY (`weighbridgeTicketId`) REFERENCES `WeighbridgeTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivedNoteLine` ADD CONSTRAINT `GoodsReceivedNoteLine_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceivedNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivedNoteLine` ADD CONSTRAINT `GoodsReceivedNoteLine_purchaseOrderLineId_fkey` FOREIGN KEY (`purchaseOrderLineId`) REFERENCES `PurchaseOrderLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierInvoice` ADD CONSTRAINT `SupplierInvoice_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierInvoice` ADD CONSTRAINT `SupplierInvoice_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreeWayMatch` ADD CONSTRAINT `ThreeWayMatch_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceivedNote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ThreeWayMatch` ADD CONSTRAINT `ThreeWayMatch_supplierInvoiceId_fkey` FOREIGN KEY (`supplierInvoiceId`) REFERENCES `SupplierInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentVoucher` ADD CONSTRAINT `PaymentVoucher_threeWayMatchId_fkey` FOREIGN KEY (`threeWayMatchId`) REFERENCES `ThreeWayMatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentVoucher` ADD CONSTRAINT `PaymentVoucher_supplierInvoiceId_fkey` FOREIGN KEY (`supplierInvoiceId`) REFERENCES `SupplierInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcurementAuditLog` ADD CONSTRAINT `ProcurementAuditLog_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
