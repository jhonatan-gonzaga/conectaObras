ALTER TABLE `store_orders`
  ADD COLUMN `address` VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN `observation` TEXT NULL;

ALTER TABLE `store_order_items`
  ADD COLUMN `productId` VARCHAR(191) NULL;

ALTER TABLE `store_order_items`
  ADD INDEX `store_order_items_productId_idx` (`productId`),
  ADD CONSTRAINT `store_order_items_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `store_order_status_history` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED') NULL,
  `toStatus` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED') NOT NULL,
  `changedById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `store_order_status_history_orderId_createdAt_idx` (`orderId`, `createdAt`),
  INDEX `store_order_status_history_changedById_idx` (`changedById`),
  PRIMARY KEY (`id`),
  CONSTRAINT `store_order_status_history_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `store_orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `store_order_status_history_changedById_fkey`
    FOREIGN KEY (`changedById`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
