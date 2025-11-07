-- Add check constraints for la_size column in layer_assets table
-- This patch should be applied after the la_size column is added

-- Clean up any invalid data in the la_size column
UPDATE /*_*/layer_assets SET la_size = 0 WHERE la_size IS NULL OR la_size < 0;

-- Add check constraints for la_size column
ALTER TABLE /*_*/layer_assets
ADD CONSTRAINT chk_la_size_positive CHECK (la_size >= 0),
ADD CONSTRAINT chk_la_size_reasonable CHECK (la_size <= 2097152); -- Max 2MB
