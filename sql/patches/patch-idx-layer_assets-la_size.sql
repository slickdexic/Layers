-- Add index on la_size column for layer_assets table
-- Split from patch-layer_assets-add-la_size.sql for SQLite compatibility
-- (SQLite does not support ALTER TABLE ADD KEY; standalone CREATE INDEX works on both)
CREATE INDEX /*i*/la_size ON /*_*/layer_assets (la_size);
