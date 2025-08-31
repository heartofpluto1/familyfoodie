-- Migration: 023_add_extensions_to_collection_filenames.sql
-- Description: Add .jpg extension to existing collection filenames that don't have extensions
-- Date: 2025-08-31
-- Purpose: Align collection filename storage with recipe system which stores extensions
-- 
-- This migration is idempotent - it can be run multiple times safely
-- It only updates filenames that don't already have extensions

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- Update filename column: add .jpg extension if no extension present
-- This is idempotent because the WHERE clause excludes already-migrated records
UPDATE collections 
SET filename = CONCAT(filename, '.jpg')
WHERE filename IS NOT NULL 
  AND filename != ''
  AND filename NOT LIKE '%.jpg'
  AND filename NOT LIKE '%.jpeg'
  AND filename NOT LIKE '%.png'
  AND filename NOT LIKE '%.webp';

-- Capture count of updated filename records
SET @filename_updates = ROW_COUNT();

-- Update filename_dark column: add .jpg extension if no extension present
-- This is idempotent because the WHERE clause excludes already-migrated records
UPDATE collections 
SET filename_dark = CONCAT(filename_dark, '.jpg')
WHERE filename_dark IS NOT NULL 
  AND filename_dark != ''
  AND filename_dark NOT LIKE '%.jpg'
  AND filename_dark NOT LIKE '%.jpeg'
  AND filename_dark NOT LIKE '%.png'
  AND filename_dark NOT LIKE '%.webp';

-- Capture count of updated filename_dark records
SET @filename_dark_updates = ROW_COUNT();

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Log the migration completion with update counts
SELECT CONCAT('Migration 023 completed: Added .jpg extension to ', 
              @filename_updates, ' filename and ', 
              @filename_dark_updates, ' filename_dark records') as status;