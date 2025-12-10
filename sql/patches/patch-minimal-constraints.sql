-- Minimal constraint patch - only the essential constraint that's failing
-- Skip la_size and lsu_usage_count constraints to avoid unknown column errors

-- Add only the most essential constraints for layer_sets
ALTER TABLE /*_*/layer_sets 
ADD CONSTRAINT chk_ls_img_name_not_empty CHECK (ls_img_name != ''),
ADD CONSTRAINT chk_ls_img_sha1_length CHECK (LENGTH(ls_img_sha1) <= 40);
