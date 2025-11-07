-- Add la_size column to layer_assets table
-- This column was added to the table definition but may be missing from existing installs

-- Check if the column exists and add it if missing
ALTER TABLE /*_*/layer_assets 
ADD COLUMN la_size int unsigned NOT NULL DEFAULT 0;

-- Add index for the new column
ALTER TABLE /*_*/layer_assets 
ADD KEY la_size (la_size);
