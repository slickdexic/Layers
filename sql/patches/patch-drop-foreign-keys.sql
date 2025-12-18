-- Drop foreign key constraints for broader compatibility
-- Foreign keys can cause issues with:
-- - Shared database setups
-- - Database replicas
-- - MediaWiki setups with non-standard user table configurations

-- Drop FK from layer_sets (if exists)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = '/*_*/layer_sets' 
    AND CONSTRAINT_NAME = 'fk_layer_sets_user_id' 
    AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE /*_*/layer_sets DROP FOREIGN KEY fk_layer_sets_user_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop FK from layer_assets (if exists)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = '/*_*/layer_assets' 
    AND CONSTRAINT_NAME = 'fk_layer_assets_user_id' 
    AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE /*_*/layer_assets DROP FOREIGN KEY fk_layer_assets_user_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop FKs from layer_set_usage (if exists)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = '/*_*/layer_set_usage' 
    AND CONSTRAINT_NAME = 'fk_layer_set_usage_layer_set_id' 
    AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE /*_*/layer_set_usage DROP FOREIGN KEY fk_layer_set_usage_layer_set_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = '/*_*/layer_set_usage' 
    AND CONSTRAINT_NAME = 'fk_layer_set_usage_page_id' 
    AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE /*_*/layer_set_usage DROP FOREIGN KEY fk_layer_set_usage_page_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
