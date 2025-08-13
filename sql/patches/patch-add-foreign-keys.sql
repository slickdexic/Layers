-- Patch to add foreign key constraints to Layers extension tables
-- This patch adds referential integrity constraints that were missing from the original schema

-- Add foreign key constraint for layer_sets.ls_user_id -> user.user_id
ALTER TABLE /*_*/layer_sets 
ADD CONSTRAINT fk_layer_sets_user_id 
FOREIGN KEY (ls_user_id) REFERENCES /*_*/user (user_id) ON DELETE CASCADE;

-- Add foreign key constraint for layer_assets.la_user_id -> user.user_id  
ALTER TABLE /*_*/layer_assets
ADD CONSTRAINT fk_layer_assets_user_id
FOREIGN KEY (la_user_id) REFERENCES /*_*/user (user_id) ON DELETE CASCADE;

-- Add foreign key constraint for layer_set_usage.lsu_layer_set_id -> layer_sets.ls_id
ALTER TABLE /*_*/layer_set_usage
ADD CONSTRAINT fk_layer_set_usage_layer_set_id
FOREIGN KEY (lsu_layer_set_id) REFERENCES /*_*/layer_sets (ls_id) ON DELETE CASCADE;

-- Add foreign key constraint for layer_set_usage.lsu_page_id -> page.page_id
ALTER TABLE /*_*/layer_set_usage
ADD CONSTRAINT fk_layer_set_usage_page_id
FOREIGN KEY (lsu_page_id) REFERENCES /*_*/page (page_id) ON DELETE CASCADE;
