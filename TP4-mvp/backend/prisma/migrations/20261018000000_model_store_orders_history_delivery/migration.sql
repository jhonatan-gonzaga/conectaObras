-- LOJA-018: campos adicionais dos pedidos
ALTER TABLE `store_orders`
    ADD COLUMN `orderNumber` VARCHAR(40) NULL,
    ADD COLUMN `subtotal` DECIMAL(10, 2) NULL,
    ADD COLUMN `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `addressSnapshot` JSON NULL,
    ADD COLUMN `note` TEXT NULL;

-- Preserva os valores dos pedidos existentes
UPDATE `store_orders`
SET `subtotal` = `total`
WHERE `subtotal` IS NULL;

-- Gera números públicos para pedidos existentes
-- Preserva o ID completo quando ele cabe no limite
UPDATE `store_orders`
SET `orderNumber` = CASE
    WHEN CHAR_LENGTH(`id`) <= 36
        THEN CONCAT('PED-', `id`)
    ELSE CONCAT('PED-', UUID())
END
WHERE `orderNumber` IS NULL;

-- Identificador público único para os pedidos
CREATE UNIQUE INDEX `store_orders_orderNumber_key`
ON `store_orders`(`orderNumber`);

-- LOJA-018: snapshots e referência opcional ao produto
ALTER TABLE `store_order_items`
    ADD COLUMN `productId` VARCHAR(191) NULL,
    ADD COLUMN `sku` VARCHAR(64) NULL,
    ADD COLUMN `lineTotal` DECIMAL(10, 2) NULL;

-- Preserva o valor total dos itens existentes
UPDATE `store_order_items`
SET `lineTotal` = `quantity` * `unitPrice`
WHERE `lineTotal` IS NULL;

CREATE INDEX `store_order_items_productId_idx`
ON `store_order_items`(`productId`);

ALTER TABLE `store_order_items`
ADD CONSTRAINT `store_order_items_productId_fkey`
FOREIGN KEY (`productId`) REFERENCES `products`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- LOJA-018: histórico de alterações de status
CREATE TABLE `order_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM(
        'PENDING', 'CONFIRMED', 'PREPARING',
        'READY', 'COMPLETED', 'CANCELED'
    ) NULL,
    `toStatus` ENUM(
        'PENDING', 'CONFIRMED', 'PREPARING',
        'READY', 'COMPLETED', 'CANCELED'
    ) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_status_history_orderId_createdAt_idx`(`orderId`, `createdAt`),
    INDEX `order_status_history_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `order_status_history`
ADD CONSTRAINT `order_status_history_orderId_fkey`
FOREIGN KEY (`orderId`) REFERENCES `store_orders`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_status_history`
ADD CONSTRAINT `order_status_history_actorId_fkey`
FOREIGN KEY (`actorId`) REFERENCES `users`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;


-- LOJA-018: informações de entrega
CREATE TABLE `deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `status` ENUM(
        'PENDING', 'PREPARING', 'IN_TRANSIT',
        'DELIVERED', 'FAILED', 'CANCELED'
    ) NOT NULL DEFAULT 'PENDING',
    `trackingCode` VARCHAR(191) NULL,
    `carrier` VARCHAR(191) NULL,
    `estimatedDate` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `deliveries_orderId_key`(`orderId`),
    INDEX `deliveries_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `deliveries`
ADD CONSTRAINT `deliveries_orderId_fkey`
FOREIGN KEY (`orderId`) REFERENCES `store_orders`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;