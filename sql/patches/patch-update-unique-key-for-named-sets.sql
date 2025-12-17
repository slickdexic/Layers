-- Update unique key to include ls_name for named layer sets
-- This allows multiple named sets per image, each with their own revision sequence
-- Old key: ls_img_name_revision (ls_img_name, ls_img_sha1, ls_revision)
-- New key: ls_img_name_set_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision)

-- Drop the old unique key (must exist from initial schema)
ALTER TABLE /*_*/layer_sets DROP INDEX ls_img_name_revision;

-- Create the new unique key that includes ls_name
ALTER TABLE /*_*/layer_sets ADD UNIQUE KEY ls_img_name_set_revision (ls_img_name, ls_img_sha1, ls_name, ls_revision);
