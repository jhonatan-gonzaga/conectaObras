CREATE TABLE `product_inventory_events` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `priceChanged` BOOLEAN NOT NULL,
  `stockChanged` BOOLEAN NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `product_inventory_events_change_chk` CHECK (`priceChanged` OR `stockChanged`),
  INDEX `product_inventory_events_productId_occurredAt_idx`(`productId`, `occurredAt`),
  INDEX `product_inventory_events_storeId_occurredAt_idx`(`storeId`, `occurredAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `product_inventory_events_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
