-- Operational rollback: preserves all tables and data from LOJA-001.
ALTER TABLE `store_opening_hours` DROP CHECK `store_opening_hours_times_check`;
ALTER TABLE `store_addresses` DROP CHECK `store_addresses_zip_digits_check`;
ALTER TABLE `store_profiles`
  DROP CHECK `store_profiles_complete_check`,
  DROP CHECK `store_profiles_cnpj_digits_check`;
