-- Clean up invalid data in Layers extension tables
-- This patch should run before any constraints are applied

-- Clean up any invalid data in layer_sets table
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE ls_img_sha1 IS NULL;
UPDATE /*_*/layer_sets SET ls_img_name = 'unknown' WHERE ls_img_name = '' OR ls_img_name IS NULL;

-- Clean up any invalid SHA1 values - be very aggressive
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE LENGTH(ls_img_sha1) > 40;
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE ls_img_sha1 REGEXP '[^a-fA-F0-9]' AND ls_img_sha1 != '';

-- Clean up numeric columns  
UPDATE /*_*/layer_sets SET ls_size = 0 WHERE ls_size IS NULL OR ls_size < 0;
UPDATE /*_*/layer_sets SET ls_layer_count = 0 WHERE ls_layer_count IS NULL OR ls_layer_count < 0; 
UPDATE /*_*/layer_sets SET ls_revision = 1 WHERE ls_revision IS NULL OR ls_revision < 1;

-- Clean up layer_assets table
UPDATE /*_*/layer_assets SET la_title = 'unknown' WHERE la_title = '' OR la_title IS NULL;
UPDATE /*_*/layer_assets SET la_size = 0 WHERE la_size IS NULL OR la_size < 0;

-- Clean up layer_set_usage table
UPDATE /*_*/layer_set_usage SET lsu_usage_count = 0 WHERE lsu_usage_count IS NULL OR lsu_usage_count < 0;
