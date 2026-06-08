/*
  Warnings:

  - You are about to drop the column `direction` on the `weighbridgeticket` table. All the data in the column will be lost.
  - You are about to drop the column `grossWeightKg` on the `weighbridgeticket` table. All the data in the column will be lost.
  - You are about to drop the column `tareWeightKg` on the `weighbridgeticket` table. All the data in the column will be lost.
  - You are about to drop the column `truckRegistration` on the `weighbridgeticket` table. All the data in the column will be lost.
  - You are about to drop the column `weighedInAt` on the `weighbridgeticket` table. All the data in the column will be lost.
  - You are about to drop the column `weighedOutAt` on the `weighbridgeticket` table. All the data in the column will be lost.
  - Added the required column `type` to the `WeighbridgeTicket` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `weighbridgeticket` DROP COLUMN `direction`,
    DROP COLUMN `grossWeightKg`,
    DROP COLUMN `tareWeightKg`,
    DROP COLUMN `truckRegistration`,
    DROP COLUMN `weighedInAt`,
    DROP COLUMN `weighedOutAt`,
    ADD COLUMN `amountCharged` DECIMAL(12, 2) NULL,
    ADD COLUMN `assignedDriverName` VARCHAR(191) NULL,
    ADD COLUMN `cancellationReason` TEXT NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancelledByUserId` VARCHAR(191) NULL,
    ADD COLUMN `completedAt` DATETIME(3) NULL,
    ADD COLUMN `customerName` VARCHAR(191) NULL,
    ADD COLUMN `firstWeightAt` DATETIME(3) NULL,
    ADD COLUMN `firstWeightKg` DECIMAL(12, 3) NULL,
    ADD COLUMN `isManual` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `operatorUserId` VARCHAR(191) NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NULL,
    ADD COLUMN `receiptReference` VARCHAR(191) NULL,
    ADD COLUMN `salesOrderId` VARCHAR(191) NULL,
    ADD COLUMN `secondWeightAt` DATETIME(3) NULL,
    ADD COLUMN `secondWeightKg` DECIMAL(12, 3) NULL,
    ADD COLUMN `serviceDescription` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `supplierDriverName` VARCHAR(191) NULL,
    ADD COLUMN `supplierName` VARCHAR(191) NULL,
    ADD COLUMN `tareVarianceKg` DECIMAL(12, 3) NULL,
    ADD COLUMN `toleranceKg` DECIMAL(12, 3) NOT NULL DEFAULT 50,
    ADD COLUMN `truckMasterId` VARCHAR(191) NULL,
    ADD COLUMN `type` ENUM('PURCHASE', 'SALE', 'OTHERS') NOT NULL,
    ADD COLUMN `varianceFlagged` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `vehiclePlate` VARCHAR(191) NULL,
    MODIFY `netWeightKg` DECIMAL(12, 3) NULL;

-- CreateTable
CREATE TABLE `WeighbridgeTruckMaster` (
    `id` VARCHAR(191) NOT NULL,
    `licensePlate` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `masterTareKg` DECIMAL(12, 3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WeighbridgeTruckMaster_licensePlate_key`(`licensePlate`),
    INDEX `WeighbridgeTruckMaster_licensePlate_idx`(`licensePlate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeighbridgeTruckDriverAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `truckId` VARCHAR(191) NOT NULL,
    `driverName` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unassignedAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WeighbridgeTruckDriverAssignment_truckId_isActive_idx`(`truckId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `WeighbridgeTicket_status_type_createdAt_idx` ON `WeighbridgeTicket`(`status`, `type`, `createdAt`);

-- CreateIndex
CREATE INDEX `WeighbridgeTicket_vehiclePlate_idx` ON `WeighbridgeTicket`(`vehiclePlate`);

-- CreateIndex
CREATE INDEX `WeighbridgeTicket_salesOrderId_idx` ON `WeighbridgeTicket`(`salesOrderId`);

-- CreateIndex
CREATE INDEX `WeighbridgeTicket_truckMasterId_idx` ON `WeighbridgeTicket`(`truckMasterId`);

-- AddForeignKey
ALTER TABLE `WeighbridgeTruckDriverAssignment` ADD CONSTRAINT `WeighbridgeTruckDriverAssignment_truckId_fkey` FOREIGN KEY (`truckId`) REFERENCES `WeighbridgeTruckMaster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeighbridgeTicket` ADD CONSTRAINT `WeighbridgeTicket_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeighbridgeTicket` ADD CONSTRAINT `WeighbridgeTicket_truckMasterId_fkey` FOREIGN KEY (`truckMasterId`) REFERENCES `WeighbridgeTruckMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
