-- Change ls_layer_count from TINYINT (max 255) to SMALLINT (max 65535)
-- to support configurable $wgLayersMaxLayerCount values above 255
ALTER TABLE /*_*/layer_sets MODIFY COLUMN ls_layer_count smallint unsigned NOT NULL DEFAULT 0;
