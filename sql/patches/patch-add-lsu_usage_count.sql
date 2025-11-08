-- Add the missing lsu_usage_count column to the layer_set_usage table

ALTER TABLE /*_*/layer_set_usage ADD COLUMN lsu_usage_count INT UNSIGNED NOT NULL DEFAULT 0;
