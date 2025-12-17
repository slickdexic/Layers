-- Add ls_name column for named layer sets feature
-- This patch is for installations upgrading from older versions
-- that didn't have the named sets feature

-- Add the ls_name column if it doesn't exist
-- For MySQL/MariaDB, we use ALTER TABLE with IF NOT EXISTS equivalent via procedure
-- Note: Standard MySQL doesn't support IF NOT EXISTS for columns, 
-- so MediaWiki's addExtensionField handles this check

ALTER TABLE /*_*/layer_sets ADD COLUMN ls_name varchar(255) DEFAULT NULL AFTER ls_revision;
