-- Migration 007: Create collections table and rename existing tables
-- This migration:
-- 1. Creates a collections table with title, subtitle, and filename
-- 2. Renames menus_recipe to recipes
-- 3. Renames menus_recipeweek to plans
-- 4. Adds collection_id to recipes table for one-to-many relationship

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create collections table
CREATE TABLE IF NOT EXISTS collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_title (title)
);

-- 2. Rename menus_recipe to recipes if menus_recipe exists
-- Check if menus_recipe exists and recipes doesn't exist, then rename
SET @rename_recipe_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_recipe') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipes') = 0,
        'RENAME TABLE menus_recipe TO recipes',
        'SELECT "menus_recipe rename not needed" as message'
    )
);
PREPARE rename_recipe_stmt FROM @rename_recipe_sql;
EXECUTE rename_recipe_stmt;
DEALLOCATE PREPARE rename_recipe_stmt;

-- 3. Rename menus_recipeweek to plans if menus_recipeweek exists
-- Check if menus_recipeweek exists and plans doesn't exist, then rename
SET @rename_plans_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_recipeweek') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'plans') = 0,
        'RENAME TABLE menus_recipeweek TO plans',
        'SELECT "menus_recipeweek rename not needed" as message'
    )
);
PREPARE rename_plans_stmt FROM @rename_plans_sql;
EXECUTE rename_plans_stmt;
DEALLOCATE PREPARE rename_plans_stmt;

-- 4. Add collection_id to recipes table for one-to-many relationship
-- Check if collection_id column doesn't exist, then add it
SET @add_column_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipes') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recipes' AND column_name = 'collection_id') = 0,
        'ALTER TABLE recipes ADD COLUMN collection_id INT NULL, ADD INDEX idx_collection_id (collection_id)',
        'SELECT "collection_id column already exists" as message'
    )
);
PREPARE add_column_stmt FROM @add_column_sql;
EXECUTE add_column_stmt;
DEALLOCATE PREPARE add_column_stmt;

-- 5. Add foreign key constraint for collection relationship
-- Check if foreign key doesn't exist, then add it
SET @add_fk_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.table_constraints 
         WHERE table_schema = DATABASE() 
         AND table_name = 'recipes' 
         AND constraint_name = 'fk_recipes_collection') = 0
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipes') > 0
        AND
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'recipes' AND column_name = 'collection_id') > 0,
        'ALTER TABLE recipes ADD CONSTRAINT fk_recipes_collection FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE ON UPDATE CASCADE',
        'SELECT "foreign key constraint not needed" as message'
    )
);
PREPARE add_fk_stmt FROM @add_fk_sql;
EXECUTE add_fk_stmt;
DEALLOCATE PREPARE add_fk_stmt;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 007 completed: Created collections table and renamed menus_recipe to recipes, menus_recipeweek to plans' as status;