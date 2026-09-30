CREATE TABLE `store_promotions` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NULL,
  `name` VARCHAR(120) NOT NULL,
  `discountPct` DECIMAL(5, 2) NOT NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'ENDED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  CONSTRAINT `store_promotions_discount_range_chk` CHECK (`discountPct` > 0 AND `discountPct` <= 100),
  CONSTRAINT `store_promotions_date_range_chk` CHECK (`startsAt` IS NULL OR `endsAt` IS NULL OR `endsAt` > `startsAt`),
  INDEX `store_promotions_storeId_status_idx`(`storeId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `store_promotions_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `store_promotions_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `store_orders` (
  `id` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
  `total` DECIMAL(10, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  CONSTRAINT `store_orders_total_positive_chk` CHECK (`total` > 0),
  INDEX `store_orders_storeId_status_createdAt_idx`(`storeId`, `status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `store_orders_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `store_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `store_orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `store_order_items` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unitPrice` DECIMAL(10, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `store_order_items_quantity_positive_chk` CHECK (`quantity` > 0),
  CONSTRAINT `store_order_items_price_positive_chk` CHECK (`unitPrice` > 0),
  INDEX `store_order_items_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `store_order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `store_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
