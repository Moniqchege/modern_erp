-- AlterTable
ALTER TABLE `user` ADD COLUMN `forcePasswordReset` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passwordHash` VARCHAR(191) NULL;
