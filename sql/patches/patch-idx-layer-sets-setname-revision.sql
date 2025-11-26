-- Index for revision counting per named set
-- Supports: Efficient COUNT(*) queries for limit enforcement
CREATE INDEX /*i*/idx_layer_sets_setname_revision 
ON /*_*/layer_sets (ls_img_name, ls_img_sha1, ls_name, ls_revision DESC);
