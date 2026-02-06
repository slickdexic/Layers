-- Add check constraints for data integrity in layer_sets table
-- This patch should be applied after the base tables are created

-- First, clean up any invalid data to ensure constraints can be applied
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE ls_img_sha1 IS NULL;
UPDATE /*_*/layer_sets SET ls_img_name = 'unknown' WHERE ls_img_name = '' OR ls_img_name IS NULL;
UPDATE /*_*/layer_sets SET ls_size = 0 WHERE ls_size IS NULL OR ls_size < 0;
UPDATE /*_*/layer_sets SET ls_layer_count = 0 WHERE ls_layer_count IS NULL OR ls_layer_count < 0;
UPDATE /*_*/layer_sets SET ls_revision = 1 WHERE ls_revision IS NULL OR ls_revision < 1;

-- Add check constraints to layer_sets table (relaxed SHA1 constraint)
ALTER TABLE /*_*/layer_sets 
ADD CONSTRAINT chk_ls_size_positive CHECK (ls_size >= 0),
ADD CONSTRAINT chk_ls_size_reasonable CHECK (ls_size <= 52428800), -- 50MB hard safety ceiling; actual limit enforced by PHP ($wgLayersMaxBytes)
ADD CONSTRAINT chk_ls_layer_count_positive CHECK (ls_layer_count >= 0),
ADD CONSTRAINT chk_ls_layer_count_reasonable CHECK (ls_layer_count <= 1000), -- Hard safety ceiling; actual limit enforced by PHP ($wgLayersMaxLayerCount)
ADD CONSTRAINT chk_ls_revision_positive CHECK (ls_revision >= 1),
ADD CONSTRAINT chk_ls_img_name_not_empty CHECK (ls_img_name != ''),
ADD CONSTRAINT chk_ls_img_sha1_format CHECK (ls_img_sha1 IS NULL OR LENGTH(ls_img_sha1) <= 40);

-- Clean up any invalid data in layer_assets table (skip if la_size column doesn't exist yet)
-- UPDATE /*_*/layer_assets SET la_size = 0 WHERE la_size IS NULL OR la_size < 0;
UPDATE /*_*/layer_assets SET la_title = 'unknown' WHERE la_title = '' OR la_title IS NULL;

-- Add check constraints to layer_assets table (skip la_size constraints for now)
-- ADD CONSTRAINT chk_la_size_positive CHECK (la_size >= 0),
-- ADD CONSTRAINT chk_la_size_reasonable CHECK (la_size <= 2097152), -- Max 2MB
ALTER TABLE /*_*/layer_assets
ADD CONSTRAINT chk_la_title_not_empty CHECK (la_title != '');

-- Clean up any invalid data in layer_set_usage table
UPDATE /*_*/layer_set_usage SET lsu_usage_count = 0 WHERE lsu_usage_count IS NULL OR lsu_usage_count < 0;

-- Add check constraints to layer_set_usage table
ALTER TABLE /*_*/layer_set_usage
ADD CONSTRAINT chk_lsu_usage_count_positive CHECK (lsu_usage_count >= 0),
ADD CONSTRAINT chk_lsu_usage_count_reasonable CHECK (lsu_usage_count <= 1000000); -- Prevent overflow
