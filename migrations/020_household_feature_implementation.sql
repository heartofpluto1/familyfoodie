-- Migration: 020_household_feature_implementation.sql
-- Agent 1: Database & Migration Implementation
-- Description: Complete household feature implementation with all schema changes and data migration

-- =============================================================================
-- PHASE 1: SCHEMA CREATION (Tasks 1.1, 1.2, 1.3)
-- =============================================================================

-- Task 1.1: Create core household infrastructure tables
CREATE TABLE IF NOT EXISTS households (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Task 1.2: Create collection_recipes junction table (key optimization)
CREATE TABLE IF NOT EXISTS collection_recipes (
    collection_id INT NOT NULL,
    recipe_id INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    display_order INT DEFAULT 0,
    PRIMARY KEY (collection_id, recipe_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    INDEX idx_recipe_collection (recipe_id, collection_id),
    INDEX idx_display_order (collection_id, display_order)
);

-- Task 1.3: Create collection subscription system tables
CREATE TABLE IF NOT EXISTS collection_subscriptions (
    household_id INT NOT NULL,
    collection_id INT NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (household_id, collection_id),
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    INDEX idx_household (household_id),
    INDEX idx_collection (collection_id)
);

-- =============================================================================
-- PHASE 2: TABLE MODIFICATIONS (Tasks 2.1, 2.2, 2.3, 2.4, 2.5)
-- =============================================================================

-- Task 2.1: Add user-household relationship column
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'household_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE users ADD COLUMN household_id INT', 
    'SELECT "users.household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND INDEX_NAME = 'idx_household_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE users ADD INDEX idx_household_id (household_id)', 
    'SELECT "users.idx_household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Task 2.2: Add collection ownership and parent tracking
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'collections' 
    AND COLUMN_NAME = 'household_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE collections ADD COLUMN household_id INT', 
    'SELECT "collections.household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'collections' 
    AND COLUMN_NAME = 'public'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE collections ADD COLUMN public TINYINT(1) DEFAULT 0', 
    'SELECT "collections.public already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'collections' 
    AND COLUMN_NAME = 'parent_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE collections ADD COLUMN parent_id INT NULL', 
    'SELECT "collections.parent_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'collections' 
    AND INDEX_NAME = 'idx_household_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE collections ADD INDEX idx_household_id (household_id)', 
    'SELECT "collections.idx_household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'collections' 
    AND INDEX_NAME = 'idx_parent_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE collections ADD INDEX idx_parent_id (parent_id)', 
    'SELECT "collections.idx_parent_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'collections' 
    AND INDEX_NAME = 'idx_public'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE collections ADD INDEX idx_public (public)', 
    'SELECT "collections.idx_public already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Task 2.3: Add recipe copy-on-write setup columns
-- NOTE: Keep collection_id for now - we'll drop it after data migration
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND COLUMN_NAME = 'household_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE recipes ADD COLUMN household_id INT', 
    'SELECT "recipes.household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND COLUMN_NAME = 'parent_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE recipes ADD COLUMN parent_id INT NULL', 
    'SELECT "recipes.parent_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND INDEX_NAME = 'idx_household_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE recipes ADD INDEX idx_household_id (household_id)', 
    'SELECT "recipes.idx_household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND INDEX_NAME = 'idx_parent_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE recipes ADD INDEX idx_parent_id (parent_id)', 
    'SELECT "recipes.idx_parent_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Task 2.4: Add household ownership to ingredients and recipe_ingredients
-- Add parent tracking to recipe_ingredients (no household_id needed - ownership flows from recipes)
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipe_ingredients' 
    AND COLUMN_NAME = 'parent_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE recipe_ingredients ADD COLUMN parent_id INT NULL', 
    'SELECT "recipe_ingredients.parent_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipe_ingredients' 
    AND INDEX_NAME = 'idx_parent_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE recipe_ingredients ADD INDEX idx_parent_id (parent_id)', 
    'SELECT "recipe_ingredients.idx_parent_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add household ownership to ingredients
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ingredients' 
    AND COLUMN_NAME = 'household_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE ingredients ADD COLUMN household_id INT', 
    'SELECT "ingredients.household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ingredients' 
    AND COLUMN_NAME = 'parent_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE ingredients ADD COLUMN parent_id INT NULL', 
    'SELECT "ingredients.parent_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ingredients' 
    AND INDEX_NAME = 'idx_household_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE ingredients ADD INDEX idx_household_id (household_id)', 
    'SELECT "ingredients.idx_household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ingredients' 
    AND INDEX_NAME = 'idx_parent_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE ingredients ADD INDEX idx_parent_id (parent_id)', 
    'SELECT "ingredients.idx_parent_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Task 2.5: Add household scope to private data tables
-- Add household scope to plans (meal planning)
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'plans' 
    AND COLUMN_NAME = 'household_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE plans ADD COLUMN household_id INT', 
    'SELECT "plans.household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'plans' 
    AND INDEX_NAME = 'idx_household_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE plans ADD INDEX idx_household_id (household_id)', 
    'SELECT "plans.idx_household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'plans' 
    AND INDEX_NAME = 'idx_household_week_year'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE plans ADD INDEX idx_household_week_year (household_id, week, year)', 
    'SELECT "plans.idx_household_week_year already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add household scope to shopping_lists
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shopping_lists' 
    AND COLUMN_NAME = 'household_id'
);
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE shopping_lists ADD COLUMN household_id INT', 
    'SELECT "shopping_lists.household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shopping_lists' 
    AND INDEX_NAME = 'idx_household_id'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE shopping_lists ADD INDEX idx_household_id (household_id)', 
    'SELECT "shopping_lists.idx_household_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shopping_lists' 
    AND INDEX_NAME = 'idx_household_week_year'
);
SET @sql = IF(@index_exists = 0, 
    'ALTER TABLE shopping_lists ADD INDEX idx_household_week_year (household_id, week, year)', 
    'SELECT "shopping_lists.idx_household_week_year already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- PHASE 3: DATA MIGRATION (Tasks 3.1, 3.2, 3.3)
-- =============================================================================

-- Task 3.1: Create Spencer household and assign users
-- Only create Spencer household if it doesn't exist
INSERT INTO households (name) 
SELECT 'Spencer' WHERE NOT EXISTS (SELECT 1 FROM households WHERE name = 'Spencer');

-- Get Spencer household ID (whether just created or already exists)
SET @spencer_household_id = (SELECT id FROM households WHERE name = 'Spencer');

-- Assign all existing users to Spencer household (only if they don't have one)
UPDATE users SET household_id = @spencer_household_id WHERE household_id IS NULL;

-- Task 3.2: Assign household ownership to all resources
-- Spencer owns all existing collections, recipes, and ingredients (only if not already assigned)
UPDATE collections SET household_id = @spencer_household_id, public = 0 WHERE household_id IS NULL;
-- Make collection_id=1 public by default (Spencer's essentials)
UPDATE collections SET public = 1 WHERE id = 1;
UPDATE recipes SET household_id = @spencer_household_id WHERE household_id IS NULL;
UPDATE ingredients SET household_id = @spencer_household_id WHERE household_id IS NULL;
UPDATE plans SET household_id = @spencer_household_id WHERE household_id IS NULL;
UPDATE shopping_lists SET household_id = @spencer_household_id WHERE household_id IS NULL;

-- Task 3.3: Populate junction tables with existing relationships
-- Migrate existing recipe-collection relationships to junction table (avoid duplicates)
-- Only migrate if collection_id column still exists on recipes table
SET @collection_id_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND COLUMN_NAME = 'collection_id'
);

-- Check if collection_recipes table already has data to avoid duplicate population
SET @junction_data_exists = (
    SELECT COUNT(*) FROM collection_recipes LIMIT 1
);

SET @sql = IF(@collection_id_exists > 0, 
    'INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
     SELECT collection_id, id, NOW() 
     FROM recipes 
     WHERE collection_id IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM collection_recipes cr 
         WHERE cr.collection_id = recipes.collection_id 
         AND cr.recipe_id = recipes.id
     )', 
    IF(@junction_data_exists = 0,
        'INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
         SELECT 1, id, NOW() 
         FROM recipes 
         WHERE NOT EXISTS (
             SELECT 1 FROM collection_recipes cr 
             WHERE cr.collection_id = 1 
             AND cr.recipe_id = recipes.id
         )',
        'SELECT "collection_recipes table already has data - skipping default population" as message'
    )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Auto-subscribe all households to collection_id=1 (Spencer's essentials) - avoid duplicates
INSERT INTO collection_subscriptions (household_id, collection_id)
SELECT h.id, 1 FROM households h
WHERE 1 IN (SELECT id FROM collections WHERE id = 1)
AND NOT EXISTS (
    SELECT 1 FROM collection_subscriptions cs 
    WHERE cs.household_id = h.id AND cs.collection_id = 1
);

-- =============================================================================
-- PHASE 4: REMOVE OLD SCHEMA (After Data Migration)
-- =============================================================================

-- Now safe to drop collection_id from recipes since data is migrated to junction table
-- Only drop if the foreign key constraint exists
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND CONSTRAINT_NAME = 'fk_recipes_collection'
);
SET @sql = IF(@constraint_exists > 0, 
    'ALTER TABLE recipes DROP FOREIGN KEY fk_recipes_collection', 
    'SELECT "fk_recipes_collection constraint does not exist" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Only drop if the collection_id column exists
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND COLUMN_NAME = 'collection_id'
);
SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE recipes DROP COLUMN collection_id', 
    'SELECT "collection_id column does not exist" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- PHASE 5: ADD FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add foreign key constraints after data migration (only if they don't exist)

-- Check and add users household constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND CONSTRAINT_NAME = 'fk_users_household'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE users ADD CONSTRAINT fk_users_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT ON UPDATE CASCADE', 
    'SELECT "fk_users_household already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add collections household constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'collections' 
    AND CONSTRAINT_NAME = 'fk_collections_household'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE collections ADD CONSTRAINT fk_collections_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE', 
    'SELECT "fk_collections_household already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add collections parent constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'collections' 
    AND CONSTRAINT_NAME = 'fk_collections_parent'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE collections ADD CONSTRAINT fk_collections_parent FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE SET NULL ON UPDATE CASCADE', 
    'SELECT "fk_collections_parent already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add recipes household constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND CONSTRAINT_NAME = 'fk_recipes_household'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE recipes ADD CONSTRAINT fk_recipes_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE', 
    'SELECT "fk_recipes_household already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add recipes parent constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND CONSTRAINT_NAME = 'fk_recipes_parent'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE recipes ADD CONSTRAINT fk_recipes_parent FOREIGN KEY (parent_id) REFERENCES recipes(id) ON DELETE SET NULL ON UPDATE CASCADE', 
    'SELECT "fk_recipes_parent already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add recipe_ingredients parent constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipe_ingredients' 
    AND CONSTRAINT_NAME = 'fk_recipe_ingredients_parent'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE recipe_ingredients ADD CONSTRAINT fk_recipe_ingredients_parent FOREIGN KEY (parent_id) REFERENCES recipe_ingredients(id) ON DELETE SET NULL ON UPDATE CASCADE', 
    'SELECT "fk_recipe_ingredients_parent already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ingredients household constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ingredients' 
    AND CONSTRAINT_NAME = 'fk_ingredients_household'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE ingredients ADD CONSTRAINT fk_ingredients_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE', 
    'SELECT "fk_ingredients_household already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add ingredients parent constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ingredients' 
    AND CONSTRAINT_NAME = 'fk_ingredients_parent'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE ingredients ADD CONSTRAINT fk_ingredients_parent FOREIGN KEY (parent_id) REFERENCES ingredients(id) ON DELETE SET NULL ON UPDATE CASCADE', 
    'SELECT "fk_ingredients_parent already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add plans household constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'plans' 
    AND CONSTRAINT_NAME = 'fk_plans_household'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE plans ADD CONSTRAINT fk_plans_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE', 
    'SELECT "fk_plans_household already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add shopping_lists household constraint
SET @constraint_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shopping_lists' 
    AND CONSTRAINT_NAME = 'fk_shopping_lists_household'
);
SET @sql = IF(@constraint_exists = 0, 
    'ALTER TABLE shopping_lists ADD CONSTRAINT fk_shopping_lists_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE', 
    'SELECT "fk_shopping_lists_household already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- PHASE 6: MAKE COLUMNS NOT NULL AFTER DATA MIGRATION
-- =============================================================================

-- Make household_id columns NOT NULL after data is populated
ALTER TABLE users MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE collections MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE recipes MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE ingredients MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE plans MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE shopping_lists MODIFY COLUMN household_id INT NOT NULL;

-- =============================================================================
-- PHASE 7: RENAME DUPLICATE COLUMN TO ARCHIVED
-- =============================================================================

-- Rename duplicate column to archived for better semantic meaning
-- Check if the column rename is needed
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'recipes' 
    AND COLUMN_NAME = 'duplicate'
);
SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE recipes CHANGE duplicate archived TINYINT(1) NOT NULL', 
    'SELECT "duplicate column already renamed or does not exist" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================================================
-- MIGRATION COMPLETE - Database Schema Ready for Application Layer
-- =============================================================================

-- Note: Copy-on-write logic has been moved to application layer TypeScript functions:
-- - src/lib/copy-on-write.ts (main functions)
-- - src/lib/queries/copy-operations.ts (database utilities)
-- - src/lib/copy-on-write.test.ts (unit tests)
-- - src/lib/queries/copy-operations.test.ts (database query tests)