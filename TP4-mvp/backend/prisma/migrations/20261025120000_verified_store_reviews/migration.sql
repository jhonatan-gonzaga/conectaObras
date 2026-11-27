CREATE TABLE `store_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_reviews_orderId_key`(`orderId`),
    INDEX `store_reviews_storeId_createdAt_id_idx`(`storeId`, `createdAt`, `id`),
    INDEX `store_reviews_storeId_rating_idx`(`storeId`, `rating`),
    INDEX `store_reviews_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `store_reviews_rating_check` CHECK (`rating` BETWEEN 1 AND 5)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `store_reviews`
    ADD CONSTRAINT `store_reviews_orderId_fkey` FOREIGN KEY (`orderId`)
        REFERENCES `store_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `store_reviews_storeId_fkey` FOREIGN KEY (`storeId`)
        REFERENCES `store_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `store_reviews_customerId_fkey` FOREIGN KEY (`customerId`)
        REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
