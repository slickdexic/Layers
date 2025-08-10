-- Add performance columns if missing
ALTER TABLE /*_*/layer_sets
	ADD COLUMN IF NOT EXISTS ls_size int unsigned NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS ls_layer_count tinyint unsigned NOT NULL DEFAULT 0;
