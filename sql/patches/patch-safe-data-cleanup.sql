-- Minimal safe data cleanup for Layers extension
-- Only clean up the specific columns that are causing constraint violations

-- Only update the core layer_sets columns that should always exist
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE ls_img_sha1 IS NULL;
UPDATE /*_*/layer_sets SET ls_img_name = 'unknown' WHERE ls_img_name = '' OR ls_img_name IS NULL;

-- Clean up only problematic SHA1 values (if they exist)
UPDATE /*_*/layer_sets SET ls_img_sha1 = '' WHERE LENGTH(ls_img_sha1) > 40;

-- Skip all other table updates to avoid unknown column errors
