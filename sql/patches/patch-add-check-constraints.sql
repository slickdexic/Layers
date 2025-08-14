-- Add check constraints for data integrity in layer_sets table
-- This patch should be applied after the base tables are created

-- Add check constraints to layer_sets table
ALTER TABLE /*_*/layer_sets 
ADD CONSTRAINT chk_ls_size_positive CHECK (ls_size >= 0),
ADD CONSTRAINT chk_ls_size_reasonable CHECK (ls_size <= 2097152), -- Max 2MB
ADD CONSTRAINT chk_ls_layer_count_positive CHECK (ls_layer_count >= 0),
ADD CONSTRAINT chk_ls_layer_count_reasonable CHECK (ls_layer_count <= 100), -- Max 100 layers
ADD CONSTRAINT chk_ls_revision_positive CHECK (ls_revision >= 1),
ADD CONSTRAINT chk_ls_img_name_not_empty CHECK (ls_img_name != ''),
ADD CONSTRAINT chk_ls_img_sha1_format CHECK (ls_img_sha1 REGEXP '^[a-fA-F0-9]{32}$');

-- Add check constraints to layer_assets table  
ALTER TABLE /*_*/layer_assets
ADD CONSTRAINT chk_la_size_positive CHECK (la_size >= 0),
ADD CONSTRAINT chk_la_size_reasonable CHECK (la_size <= 2097152), -- Max 2MB
ADD CONSTRAINT chk_la_title_not_empty CHECK (la_title != '');

-- Add check constraints to layer_set_usage table
ALTER TABLE /*_*/layer_set_usage
ADD CONSTRAINT chk_lsu_usage_count_positive CHECK (lsu_usage_count >= 0),
ADD CONSTRAINT chk_lsu_usage_count_reasonable CHECK (lsu_usage_count <= 1000000); -- Prevent overflow
