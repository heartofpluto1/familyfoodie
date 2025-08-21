-- Migration 014: Add filename_dark column to collections table
-- This migration:
-- 1. Adds filename_dark column to collections table
-- 2. Populates existing records with proper dark variants for default collections
-- 3. Uses same filename as fallback for custom uploaded collections
-- 4. Makes filename_dark NOT NULL after population

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add filename_dark column to collections table
ALTER TABLE collections 
ADD COLUMN filename_dark VARCHAR(255) NULL AFTER filename;

-- 2. Populate existing records with proper dark variants
-- Default collections get their specific _dark variants
-- Custom uploaded collections use same filename as fallback
UPDATE collections 
SET filename_dark = CASE 
    WHEN filename = 'custom_collection_001' THEN 'custom_collection_001_dark'
    WHEN filename = 'custom_collection_002' THEN 'custom_collection_002_dark'
    WHEN filename = 'custom_collection_003' THEN 'custom_collection_003_dark'
    WHEN filename = 'custom_collection_004' THEN 'custom_collection_004_dark'
    ELSE filename  -- For custom uploaded collections, use same filename as fallback
END
WHERE filename_dark IS NULL;

-- 3. Make filename_dark NOT NULL after population
ALTER TABLE collections 
MODIFY COLUMN filename_dark VARCHAR(255) NOT NULL;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 014 completed: Added filename_dark column to collections table' as status;