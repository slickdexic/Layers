-- Named Layer Sets Migration
-- Part of the Named Layer Sets feature
-- Run via: php maintenance/update.php
--
-- This migration:
-- 1. Sets ls_name to 'default' for existing rows without a name
-- 2. Indexes are added via LayersSchemaManager::addExtensionIndex calls
-- 3. Does NOT break existing functionality

-- Step 1: Assign a placeholder name to pre-existing layer sets
-- Legacy rows predate named sets, so they are backfilled under a placeholder to
-- keep them addressable. Set names are user-defined and nothing is reserved.
UPDATE /*_*/layer_sets 
SET ls_name = 'default' 
WHERE ls_name IS NULL OR ls_name = '';
