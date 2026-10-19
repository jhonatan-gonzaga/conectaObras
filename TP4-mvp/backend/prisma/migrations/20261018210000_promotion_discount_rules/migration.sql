ALTER TABLE `store_promotions`
  ADD COLUMN `discountType` ENUM('PERCENTAGE', 'FIXED', 'DIRECT') NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN `discountValue` DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE `store_promotions` SET `discountValue` = `discountPct`;
