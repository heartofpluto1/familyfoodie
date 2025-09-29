-- Migration 026: Denormalize shopping lists
-- This migration makes shopping lists immutable historical records by storing
-- recipe reference and quantities directly, removing dependency on recipe_ingredients

-- Add recipe_id column if it doesn't exist
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shopping_lists'
    AND COLUMN_NAME = 'recipe_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE shopping_lists ADD COLUMN recipe_id INT DEFAULT NULL',
    'SELECT "Column recipe_id already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add quantity column if it doesn't exist
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shopping_lists'
    AND COLUMN_NAME = 'quantity'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE shopping_lists ADD COLUMN quantity VARCHAR(10) DEFAULT NULL',
    'SELECT "Column quantity already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add quantity4 column if it doesn't exist
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shopping_lists'
    AND COLUMN_NAME = 'quantity4'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE shopping_lists ADD COLUMN quantity4 VARCHAR(10) DEFAULT NULL',
    'SELECT "Column quantity4 already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add measurement column if it doesn't exist
SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shopping_lists'
    AND COLUMN_NAME = 'measurement'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE shopping_lists ADD COLUMN measurement VARCHAR(100) DEFAULT NULL',
    'SELECT "Column measurement already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key to recipes table if it doesn't exist
-- Recipes are never deleted, only archived, so this FK is safe
SET @fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shopping_lists'
    AND CONSTRAINT_NAME = 'fk_shopping_lists_recipe'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE shopping_lists ADD CONSTRAINT fk_shopping_lists_recipe FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE RESTRICT',
    'SELECT "FK already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Populate new columns from existing data for historical records
-- Only update rows where the new columns are NULL (haven't been populated yet)
UPDATE shopping_lists sl
JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
JOIN measurements m ON ri.quantityMeasure_id = m.id
SET
    sl.recipe_id = ri.recipe_id,
    sl.quantity = ri.quantity,
    sl.quantity4 = ri.quantity4,
    sl.measurement = m.name
WHERE sl.recipe_id IS NULL
   OR sl.quantity IS NULL
   OR sl.measurement IS NULL;

-- Drop foreign key constraint to recipe_ingredients if it exists
-- Check for both possible constraint names (new and Django-generated)
SET @fk_name = (
    SELECT CONSTRAINT_NAME
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shopping_lists'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND (CONSTRAINT_NAME = 'fk_shopping_lists_recipe_ingredients'
         OR CONSTRAINT_NAME = 'menus_shoppinglist_recipeIngredient_id_1b4f44ab_fk_menus_rec'
         OR CONSTRAINT_NAME LIKE '%recipeIngredient%')
    LIMIT 1
);

SET @sql = IF(@fk_name IS NOT NULL,
    CONCAT('ALTER TABLE shopping_lists DROP FOREIGN KEY ', @fk_name),
    'SELECT "FK to recipe_ingredients does not exist"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Note: We keep recipeIngredient_id column for now as deprecated
-- It can be dropped in a future migration after confirming all code is updated
-- This allows for a safer rollback if needed

-- Add index on recipe_id for better query performance if it doesn't exist
SET @idx_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
    AND table_name = 'shopping_lists'
    AND index_name = 'idx_shopping_lists_recipe'
);

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_shopping_lists_recipe ON shopping_lists(recipe_id)',
    'SELECT "Index already exists"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;