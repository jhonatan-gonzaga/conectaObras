-- MySQL >= 8.0.16. Existing invalid data must be corrected before deployment.
-- Never silently discard or change existing store registrations.
ALTER TABLE `store_profiles`
  ADD CONSTRAINT `store_profiles_cnpj_digits_check` CHECK (
    `cnpj` IS NULL OR (`cnpj` REGEXP '^[0-9]{14}$' AND CHAR_LENGTH(`cnpj`) = 14)
  ),
  ADD CONSTRAINT `store_profiles_complete_check` CHECK (
    `status` = 'DRAFT' OR (
      `name` IS NOT NULL AND CHAR_LENGTH(TRIM(`name`)) > 0 AND
      `cnpj` IS NOT NULL AND
      `phone` IS NOT NULL AND CHAR_LENGTH(TRIM(`phone`)) > 0
    )
  );

ALTER TABLE `store_addresses`
  ADD CONSTRAINT `store_addresses_zip_digits_check` CHECK (
    `zipCode` IS NULL OR (`zipCode` REGEXP '^[0-9]{8}$' AND CHAR_LENGTH(`zipCode`) = 8)
  );

ALTER TABLE `store_opening_hours`
  ADD CONSTRAINT `store_opening_hours_times_check` CHECK (
    (`closed` = true AND `openingTime` IS NULL AND `closingTime` IS NULL) OR
    (`closed` = false AND `openingTime` IS NOT NULL AND `closingTime` IS NOT NULL AND
      CHAR_LENGTH(`openingTime`) = 5 AND CHAR_LENGTH(`closingTime`) = 5 AND
      `openingTime` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
      `closingTime` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
      `openingTime` < `closingTime`)
  );
