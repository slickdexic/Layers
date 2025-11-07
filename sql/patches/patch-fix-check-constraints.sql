-- Fix check constraints for Layers extension
-- This patch cleans up data and applies constraints safely

-- Clean up any invalid data in layer_sets table (core columns that should always exist)
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE ls_img_sha1 IS NULL;
UPDATE /*_*/layer_sets SET ls_img_name = 'unknown' WHERE ls_img_name = '' OR ls_img_name IS NULL;

-- Clean up any invalid SHA1 values that are too long or contain invalid characters
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE LENGTH(ls_img_sha1) > 40;
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE ls_img_sha1 REGEXP '[^a-fA-F0-9]' AND ls_img_sha1 != '';

-- Clean up any other columns that might have invalid data
UPDATE /*_*/layer_sets SET ls_size = 0 WHERE ls_size IS NULL OR ls_size < 0;
UPDATE /*_*/layer_sets SET ls_layer_count = 0 WHERE ls_layer_count IS NULL OR ls_layer_count < 0;
UPDATE /*_*/layer_sets SET ls_revision = 1 WHERE ls_revision IS NULL OR ls_revision < 1;
