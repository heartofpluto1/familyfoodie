-- Migration 013: Add url_slug fields to collections and recipes tables
-- This migration adds permanent URL slug fields to prevent broken links when titles change
-- The url_slug fields will be used for URL generation instead of dynamic title-based slugs

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add url_slug column to collections table
-- Check if url_slug column doesn't exist, then add it
SET @add_collections_slug_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'collections') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'collections' AND column_name = 'url_slug') = 0,
        'ALTER TABLE collections ADD COLUMN url_slug VARCHAR(255) NULL, ADD INDEX idx_url_slug (url_slug)',
        'SELECT "collections url_slug column already exists" as message'
    )
);
PREPARE add_collections_slug_stmt FROM @add_collections_slug_sql;
EXECUTE add_collections_slug_stmt;
DEALLOCATE PREPARE add_collections_slug_stmt;

-- 2. Add url_slug column to recipes table
-- Check if url_slug column doesn't exist, then add it
SET @add_recipes_slug_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipes') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recipes' AND column_name = 'url_slug') = 0,
        'ALTER TABLE recipes ADD COLUMN url_slug VARCHAR(255) NULL, ADD INDEX idx_recipe_url_slug (url_slug)',
        'SELECT "recipes url_slug column already exists" as message'
    )
);
PREPARE add_recipes_slug_stmt FROM @add_recipes_slug_sql;
EXECUTE add_recipes_slug_stmt;
DEALLOCATE PREPARE add_recipes_slug_stmt;

-- 3. Populate url_slug fields with title-based slugs for existing records
-- Update collections table with generated slugs from titles
UPDATE collections 
SET url_slug = LOWER(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                TRIM(title), 
                                ' ', '-'
                            ),
                            '&', 'and'
                        ),
                        ',', ''
                    ),
                    '.', ''
                ),
                '!', ''
            ),
            '?', ''
        ),
        '--', '-'
    )
)
WHERE url_slug IS NULL AND title IS NOT NULL;

-- Update recipes table with generated slugs from names
UPDATE recipes 
SET url_slug = LOWER(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                TRIM(name), 
                                ' ', '-'
                            ),
                            '&', 'and'
                        ),
                        ',', ''
                    ),
                    '.', ''
                ),
                '!', ''
            ),
            '?', ''
        ),
        '--', '-'
    )
)
WHERE url_slug IS NULL AND name IS NOT NULL;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 013 completed: Added url_slug fields to collections and recipes tables' as status;