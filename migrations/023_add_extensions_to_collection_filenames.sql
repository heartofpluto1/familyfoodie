-- Migration: 023_add_extensions_to_collection_filenames.sql
-- Description: Add .jpg extension to existing collection filenames that don't have extensions
-- Date: 2025-08-31
-- Purpose: Align collection filename storage with recipe system which stores extensions

-- Update filename column: add .jpg extension if no extension present
UPDATE collections 
SET filename = CONCAT(filename, '.jpg')
WHERE filename IS NOT NULL 
  AND filename != ''
  AND filename NOT LIKE '%.jpg'
  AND filename NOT LIKE '%.jpeg'
  AND filename NOT LIKE '%.png'
  AND filename NOT LIKE '%.webp';

-- Update filename_dark column: add .jpg extension if no extension present  
UPDATE collections 
SET filename_dark = CONCAT(filename_dark, '.jpg')
WHERE filename_dark IS NOT NULL 
  AND filename_dark != ''
  AND filename_dark NOT LIKE '%.jpg'
  AND filename_dark NOT LIKE '%.jpeg'
  AND filename_dark NOT LIKE '%.png'
  AND filename_dark NOT LIKE '%.webp';

-- Log the migration completion
SELECT CONCAT('Migration 023: Added .jpg extension to ', 
              ROW_COUNT(), 
              ' collection filename records') AS migration_result;