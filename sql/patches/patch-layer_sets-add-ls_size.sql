-- Add ls_size column if missing
ALTER TABLE /*_*/layer_sets
	ADD COLUMN ls_size int unsigned NOT NULL DEFAULT 0;
