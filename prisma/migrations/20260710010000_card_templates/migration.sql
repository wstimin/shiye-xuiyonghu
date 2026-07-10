CREATE TABLE `card_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 10,
    `prefix` VARCHAR(32) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `remark` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `card_templates_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `card_batches` ADD COLUMN `templateId` VARCHAR(191) NULL,
    ADD COLUMN `prefix` VARCHAR(32) NULL;

CREATE INDEX `card_batches_templateId_idx` ON `card_batches`(`templateId`);

ALTER TABLE `card_batches` ADD CONSTRAINT `card_batches_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `card_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
