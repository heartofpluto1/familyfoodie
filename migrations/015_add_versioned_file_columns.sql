-- Migration 015: Add versioned file columns for recipe images and PDFs
-- This migration:
-- 1. Adds image_filename and pdf_filename columns to recipes table
-- 2. Migrates existing filename data to new columns with extensions
-- 3. Adds indexes for performance
-- 4. Drops the old filename column

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add new columns for versioned filenames
-- Check if image_filename column doesn't exist, then add it
SET @add_image_filename_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipes') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recipes' AND column_name = 'image_filename') = 0,
        'ALTER TABLE recipes ADD COLUMN image_filename VARCHAR(100) NULL',
        'SELECT "image_filename column already exists" as message'
    )
);
PREPARE add_image_filename_stmt FROM @add_image_filename_sql;
EXECUTE add_image_filename_stmt;
DEALLOCATE PREPARE add_image_filename_stmt;

-- Check if pdf_filename column doesn't exist, then add it
SET @add_pdf_filename_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipes') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recipes' AND column_name = 'pdf_filename') = 0,
        'ALTER TABLE recipes ADD COLUMN pdf_filename VARCHAR(100) NULL',
        'SELECT "pdf_filename column already exists" as message'
    )
);
PREPARE add_pdf_filename_stmt FROM @add_pdf_filename_sql;
EXECUTE add_pdf_filename_stmt;
DEALLOCATE PREPARE add_pdf_filename_stmt;

-- 2. Migrate existing filename data to new columns
-- Only update rows where the new columns are NULL and filename is not NULL
UPDATE recipes 
SET 
    image_filename = CONCAT(filename, '.jpg'),
    pdf_filename = CONCAT(filename, '.pdf')
WHERE filename IS NOT NULL 
    AND (image_filename IS NULL OR pdf_filename IS NULL);

-- 3. Add indexes for performance on new filename columns
-- Check if image_filename index doesn't exist, then add it
SET @add_image_idx_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.statistics 
         WHERE table_schema = DATABASE() 
         AND table_name = 'recipes' 
         AND index_name = 'idx_image_filename') = 0
        AND
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recipes' AND column_name = 'image_filename') > 0,
        'ALTER TABLE recipes ADD INDEX idx_image_filename (image_filename)',
        'SELECT "image_filename index not needed" as message'
    )
);
PREPARE add_image_idx_stmt FROM @add_image_idx_sql;
EXECUTE add_image_idx_stmt;
DEALLOCATE PREPARE add_image_idx_stmt;

-- Check if pdf_filename index doesn't exist, then add it
SET @add_pdf_idx_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.statistics 
         WHERE table_schema = DATABASE() 
         AND table_name = 'recipes' 
         AND index_name = 'idx_pdf_filename') = 0
        AND
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recipes' AND column_name = 'pdf_filename') > 0,
        'ALTER TABLE recipes ADD INDEX idx_pdf_filename (pdf_filename)',
        'SELECT "pdf_filename index not needed" as message'
    )
);
PREPARE add_pdf_idx_stmt FROM @add_pdf_idx_sql;
EXECUTE add_pdf_idx_stmt;
DEALLOCATE PREPARE add_pdf_idx_stmt;

-- 4. Drop the old filename column
-- Check if filename column exists, then drop it
SET @drop_filename_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recipes' AND column_name = 'filename') > 0,
        'ALTER TABLE recipes DROP COLUMN filename',
        'SELECT "filename column already dropped" as message'
    )
);
PREPARE drop_filename_stmt FROM @drop_filename_sql;
EXECUTE drop_filename_stmt;
DEALLOCATE PREPARE drop_filename_stmt;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Output migration status
SELECT 'Migration 015 completed: Added image_filename and pdf_filename columns, migrated data, and dropped old filename column' as status;

-- Show summary of migrated records
SELECT 
    COUNT(*) as total_recipes,
    COUNT(image_filename) as recipes_with_image_filename,
    COUNT(pdf_filename) as recipes_with_pdf_filename
FROM recipes;