-- Preserve convertible legacy promotions. Store-wide or incomplete promotions
-- cannot be represented by the product-scoped model and are removed.
DELETE FROM `store_promotions`
WHERE `productId` IS NULL OR `discountPct` >= 100;

UPDATE `store_promotions`
SET `startsAt` = COALESCE(`startsAt`, `createdAt`);
UPDATE `store_promotions`
SET `endsAt` = CASE
  WHEN `endsAt` IS NULL OR `endsAt` <= `startsAt` THEN DATE_ADD(`startsAt`, INTERVAL 1 DAY)
  ELSE `endsAt`
END;

ALTER TABLE `store_promotions` ADD COLUMN `enabled` BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE `store_promotions` SET `enabled` = (`status` = 'ACTIVE');

ALTER TABLE `store_promotions`
  DROP CONSTRAINT `store_promotions_discount_range_chk`,
  DROP CONSTRAINT `store_promotions_date_range_chk`,
  DROP FOREIGN KEY `store_promotions_productId_fkey`,
  DROP INDEX `store_promotions_storeId_status_idx`,
  CHANGE COLUMN `discountPct` `discountPercent` DECIMAL(5,2) NULL,
  CHANGE COLUMN `startsAt` `startAt` DATETIME(3) NOT NULL,
  CHANGE COLUMN `endsAt` `endAt` DATETIME(3) NOT NULL,
  MODIFY COLUMN `productId` VARCHAR(191) NOT NULL,
  ADD COLUMN `promotionalPrice` DECIMAL(10,2) NULL,
  DROP COLUMN `name`,
  DROP COLUMN `status`,
  ADD CONSTRAINT `store_promotions_discount_exactly_one_chk`
    CHECK ((`promotionalPrice` IS NOT NULL) <> (`discountPercent` IS NOT NULL)),
  ADD CONSTRAINT `store_promotions_discount_range_chk`
    CHECK ((`promotionalPrice` IS NULL OR `promotionalPrice` > 0)
      AND (`discountPercent` IS NULL OR (`discountPercent` > 0 AND `discountPercent` < 100))),
  ADD CONSTRAINT `store_promotions_date_range_chk` CHECK (`endAt` > `startAt`),
  ADD INDEX `store_promotions_storeId_enabled_startAt_endAt_idx` (`storeId`, `enabled`, `startAt`, `endAt`),
  ADD INDEX `store_promotions_productId_enabled_startAt_endAt_idx` (`productId`, `enabled`, `startAt`, `endAt`),
  ADD CONSTRAINT `store_promotions_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
