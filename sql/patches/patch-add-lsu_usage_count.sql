-- Add the missing lsu_usage_count column to the layer_set_usage table
-- DEFAULT 1 matches base schema (usage count starts at 1 when first used)

ALTER TABLE /*_*/layer_set_usage ADD COLUMN lsu_usage_count INT UNSIGNED NOT NULL DEFAULT 1;
