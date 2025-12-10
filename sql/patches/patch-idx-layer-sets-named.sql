-- Index for efficient named set queries
-- Supports: Finding all named sets for an image, getting revisions ordered by time
CREATE INDEX /*i*/idx_layer_sets_named 
ON /*_*/layer_sets (ls_img_name, ls_img_sha1, ls_name, ls_timestamp DESC);
