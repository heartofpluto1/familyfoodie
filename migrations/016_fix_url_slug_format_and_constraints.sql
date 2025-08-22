-- Migration 016: Fix URL slug format and constraints
-- This migration fixes the URL slug format to include ID prefixes and makes fields NOT NULL
-- The optimization in Issue 003 changed URL generation to expect {id}-{slug} format in database

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Update collections to use {id}-{slug} format
-- Only update slugs that don't already have the ID prefix format
UPDATE collections 
SET url_slug = CONCAT(id, '-', url_slug)
WHERE url_slug IS NOT NULL 
  AND url_slug NOT REGEXP '^[0-9]+-';

-- 2. Update recipes to use {id}-{slug} format  
-- Only update slugs that don't already have the ID prefix format
UPDATE recipes 
SET url_slug = CONCAT(id, '-', url_slug)
WHERE url_slug IS NOT NULL 
  AND url_slug NOT REGEXP '^[0-9]+-';

-- 3. Handle any remaining NULL values in collections
-- Generate fallback slugs with ID prefix for collections without slugs
UPDATE collections 
SET url_slug = CONCAT(
    id, 
    '-', 
    LOWER(
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
)
WHERE url_slug IS NULL AND title IS NOT NULL;

-- 4. Handle any remaining NULL values in recipes
-- Generate fallback slugs with ID prefix for recipes without slugs
UPDATE recipes 
SET url_slug = CONCAT(
    id, 
    '-', 
    LOWER(
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
)
WHERE url_slug IS NULL AND name IS NOT NULL;

-- 5. Handle edge case where title/name might be NULL or empty
-- Set a default slug for any remaining NULL values
UPDATE collections 
SET url_slug = CONCAT(id, '-untitled-collection')
WHERE url_slug IS NULL;

UPDATE recipes 
SET url_slug = CONCAT(id, '-untitled-recipe')
WHERE url_slug IS NULL;

-- 6. Make url_slug fields NOT NULL to match TypeScript type requirements
-- This prevents future NULL values and ensures type safety
ALTER TABLE collections MODIFY COLUMN url_slug VARCHAR(255) NOT NULL;
ALTER TABLE recipes MODIFY COLUMN url_slug VARCHAR(255) NOT NULL;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 016 completed: Fixed URL slug format to {id}-{slug} and made fields NOT NULL' as status;