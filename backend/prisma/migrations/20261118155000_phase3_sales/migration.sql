-- AlterTable
ALTER TABLE `Sale`
    ADD COLUMN `changeDue` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `reference` VARCHAR(64) NULL,
    ADD COLUMN `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Preserve existing sales and assign stable references before requiring the field.
UPDATE `Sale`
SET `subtotal` = `totalAmount`,
    `reference` = CONCAT('LEGACY-', `id`)
WHERE `reference` IS NULL;

-- AlterTable
ALTER TABLE `Sale` MODIFY COLUMN `reference` VARCHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Sale_reference_key` ON `Sale`(`reference`);
