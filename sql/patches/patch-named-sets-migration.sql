-- Named Layer Sets Migration
-- Part of the Named Layer Sets feature
-- Run via: php maintenance/update.php
--
-- This migration:
-- 1. Sets ls_name to 'default' for existing rows without a name
-- 2. Indexes are added via LayersSchemaManager::addExtensionIndex calls
-- 3. Does NOT break existing functionality

-- Step 1: Assign 'default' name to existing layer sets
-- This ensures all existing annotations are accessible as the 'default' set
UPDATE /*_*/layer_sets 
SET ls_name = 'default' 
WHERE ls_name IS NULL OR ls_name = '';
