-- Add ls_layer_count column if missing
ALTER TABLE /*_*/layer_sets
	ADD COLUMN ls_layer_count tinyint unsigned NOT NULL DEFAULT 0;
