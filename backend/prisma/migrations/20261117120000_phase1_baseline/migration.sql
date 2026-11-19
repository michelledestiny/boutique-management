-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `sku` VARCHAR(80) NULL,
    `description` TEXT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `stockQuantity` INTEGER NOT NULL DEFAULT 0,
    `lowStockAlertAt` INTEGER NOT NULL DEFAULT 5,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_sku_key`(`sku`),
    INDEX `Product_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockMovement` (
    `id` VARCHAR(30) NOT NULL,
    `productId` VARCHAR(30) NOT NULL,
    `type` ENUM('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `note` VARCHAR(500) NULL,
    `saleId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockMovement_productId_createdAt_idx`(`productId`, `createdAt`),
    INDEX `StockMovement_saleId_idx`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(30) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_phone_key`(`phone`),
    UNIQUE INDEX `Customer_email_key`(`email`),
    INDEX `Customer_lastName_firstName_idx`(`lastName`, `firstName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sale` (
    `id` VARCHAR(30) NOT NULL,
    `customerId` VARCHAR(30) NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `amountPaid` DECIMAL(12, 2) NOT NULL,
    `paymentStatus` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID') NOT NULL,
    `paymentMethod` ENUM('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER') NOT NULL DEFAULT 'CASH',
    `soldAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Sale_soldAt_idx`(`soldAt`),
    INDEX `Sale_customerId_soldAt_idx`(`customerId`, `soldAt`),
    INDEX `Sale_paymentStatus_soldAt_idx`(`paymentStatus`, `soldAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaleItem` (
    `id` VARCHAR(30) NOT NULL,
    `saleId` VARCHAR(30) NOT NULL,
    `productId` VARCHAR(30) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `lineTotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SaleItem_saleId_idx`(`saleId`),
    INDEX `SaleItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditPayment` (
    `id` VARCHAR(30) NOT NULL,
    `saleId` VARCHAR(30) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paymentMethod` ENUM('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER') NOT NULL DEFAULT 'CASH',
    `note` VARCHAR(500) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreditPayment_saleId_paidAt_idx`(`saleId`, `paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditPayment` ADD CONSTRAINT `CreditPayment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
