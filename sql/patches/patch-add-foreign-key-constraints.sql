-- Patch to add foreign key constraints to existing installations
-- Run this patch on databases that were created before foreign key constraints were added

-- Add foreign key constraint to layer_sets table
ALTER TABLE /*_*/layer_sets 
ADD CONSTRAINT fk_layer_sets_user_id 
FOREIGN KEY (ls_user_id) REFERENCES /*_*/user (user_id) ON DELETE CASCADE;

-- Add foreign key constraint to layer_assets table  
ALTER TABLE /*_*/layer_assets 
ADD CONSTRAINT fk_layer_assets_user_id 
FOREIGN KEY (la_user_id) REFERENCES /*_*/user (user_id) ON DELETE CASCADE;

-- Add foreign key constraints to layer_set_usage table
ALTER TABLE /*_*/layer_set_usage 
ADD CONSTRAINT fk_layer_set_usage_layer_set_id 
FOREIGN KEY (lsu_layer_set_id) REFERENCES /*_*/layer_sets (ls_id) ON DELETE CASCADE;

ALTER TABLE /*_*/layer_set_usage 
ADD CONSTRAINT fk_layer_set_usage_page_id 
FOREIGN KEY (lsu_page_id) REFERENCES /*_*/page (page_id) ON DELETE CASCADE;
