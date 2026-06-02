-- Customers & Sales module (Maize Flour Plant)
-- Apply with: npx prisma migrate deploy

-- AlterTable Customer
ALTER TABLE `Customer` ADD COLUMN `type` ENUM('DISTRIBUTOR', 'WHOLESALER', 'RETAILER', 'WALK_IN') NOT NULL DEFAULT 'RETAILER',
    ADD COLUMN `creditLimit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `currentBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `creditDays` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `taxPin` VARCHAR(32) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX `Customer_type_idx` ON `Customer`(`type`);
CREATE INDEX `Customer_status_idx` ON `Customer`(`status`);
CREATE INDEX `Customer_currentBalance_idx` ON `Customer`(`currentBalance`);

-- CreateTable SalesProduct
CREATE TABLE `SalesProduct` (
    `id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `basePrice` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'bag',
    `category` VARCHAR(64) NOT NULL DEFAULT 'FLOUR',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalesProduct_sku_key`(`sku`),
    INDEX `SalesProduct_sku_idx`(`sku`),
    INDEX `SalesProduct_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SalesOrder
CREATE TABLE `SalesOrder` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `taxAmount` DECIMAL(12, 2) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `paymentStatus` ENUM('PENDING', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'PENDING',
    `orderStatus` ENUM('DRAFT', 'CONFIRMED', 'CANCELLED', 'FULFILLED') NOT NULL DEFAULT 'DRAFT',
    `dispatchStatus` ENUM('PENDING', 'LOADING', 'DISPATCHED', 'DELIVERED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalesOrder_orderNumber_key`(`orderNumber`),
    INDEX `SalesOrder_customerId_idx`(`customerId`),
    INDEX `SalesOrder_orderStatus_idx`(`orderStatus`),
    INDEX `SalesOrder_paymentStatus_idx`(`paymentStatus`),
    INDEX `SalesOrder_dispatchStatus_idx`(`dispatchStatus`),
    INDEX `SalesOrder_orderDate_idx`(`orderDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable SalesOrderItem
CREATE TABLE `SalesOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `salesOrderId` VARCHAR(191) NOT NULL,
    `productSku` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `discountPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SalesOrderItem_salesOrderId_idx`(`salesOrderId`),
    INDEX `SalesOrderItem_productSku_idx`(`productSku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable Invoice
ALTER TABLE `Invoice` ADD COLUMN `amountDue` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `dueDate` DATETIME(3) NULL,
    ADD COLUMN `salesOrderId` VARCHAR(191) NULL;

UPDATE `Invoice` SET `amountDue` = `total` WHERE `amountDue` = 0;

ALTER TABLE `Invoice` MODIFY `status` ENUM('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID', 'OVERDUE') NOT NULL DEFAULT 'DRAFT';

CREATE UNIQUE INDEX `Invoice_salesOrderId_key` ON `Invoice`(`salesOrderId`);
CREATE INDEX `Invoice_status_idx` ON `Invoice`(`status`);
CREATE INDEX `Invoice_dueDate_idx` ON `Invoice`(`dueDate`);

-- CreateTable CustomerPayment
CREATE TABLE `CustomerPayment` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amountPaid` DECIMAL(12, 2) NOT NULL,
    `paymentMethod` ENUM('MPESA', 'BANK', 'CASH', 'CHEQUE') NOT NULL,
    `transactionReference` VARCHAR(128) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerPayment_customerId_idx`(`customerId`),
    INDEX `CustomerPayment_invoiceId_idx`(`invoiceId`),
    INDEX `CustomerPayment_paidAt_idx`(`paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SalesOrder` ADD CONSTRAINT `SalesOrder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SalesOrderItem` ADD CONSTRAINT `SalesOrderItem_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SalesOrderItem` ADD CONSTRAINT `SalesOrderItem_productSku_fkey` FOREIGN KEY (`productSku`) REFERENCES `SalesProduct`(`sku`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CustomerPayment` ADD CONSTRAINT `CustomerPayment_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomerPayment` ADD CONSTRAINT `CustomerPayment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
