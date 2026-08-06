-- Drop the layer_assets table (dead code since creation — zero reads/writes)
-- Only ever touched by the schema updater; no application code selects from
-- or inserts into it. See R1.25.
DROP TABLE IF EXISTS /*_*/layer_assets;
