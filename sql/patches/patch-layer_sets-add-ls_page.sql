-- Add ls_page column for multi-page file (e.g. PDF) support.
-- Page is 1-based; existing rows and single-page files default to page 1.
ALTER TABLE /*_*/layer_sets
	ADD COLUMN ls_page smallint unsigned NOT NULL DEFAULT 1;
