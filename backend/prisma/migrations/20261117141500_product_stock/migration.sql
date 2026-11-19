-- AlterTable
ALTER TABLE `Product` ADD COLUMN `purchasePrice` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `StockMovement` ADD COLUMN `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `StockMovement_productId_occurredAt_idx` ON `StockMovement`(`productId`, `occurredAt`);
