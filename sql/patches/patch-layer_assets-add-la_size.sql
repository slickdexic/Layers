-- Add la_size column to layer_assets table
-- This column was added to the table definition but may be missing from existing installs
-- Note: Index is added separately via patch-idx-layer_assets-la_size.sql for SQLite compatibility

ALTER TABLE /*_*/layer_assets 
ADD COLUMN la_size int unsigned NOT NULL DEFAULT 0;
