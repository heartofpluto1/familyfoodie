-- Migration: 020_household_feature_implementation.sql
-- Agent 1: Database & Migration Implementation
-- Description: Complete household feature implementation with all schema changes and data migration

-- =============================================================================
-- PHASE 1: SCHEMA CREATION (Tasks 1.1, 1.2, 1.3)
-- =============================================================================

-- Task 1.1: Create core household infrastructure tables
CREATE TABLE households (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Task 1.2: Create collection_recipes junction table (key optimization)
CREATE TABLE collection_recipes (
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
CREATE TABLE collection_subscriptions (
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
ALTER TABLE users ADD COLUMN household_id INT;
ALTER TABLE users ADD INDEX idx_household_id (household_id);

-- Task 2.2: Add collection ownership and parent tracking
ALTER TABLE collections ADD COLUMN household_id INT;
ALTER TABLE collections ADD COLUMN public TINYINT(1) DEFAULT 0;
ALTER TABLE collections ADD COLUMN parent_id INT NULL;
ALTER TABLE collections ADD INDEX idx_household_id (household_id);
ALTER TABLE collections ADD INDEX idx_parent_id (parent_id);
ALTER TABLE collections ADD INDEX idx_public (public);

-- Task 2.3: Add recipe copy-on-write setup columns
-- Remove collection_id since relationship now managed by junction table
ALTER TABLE recipes DROP FOREIGN KEY fk_recipes_collection;
ALTER TABLE recipes DROP COLUMN collection_id;
ALTER TABLE recipes ADD COLUMN household_id INT;
ALTER TABLE recipes ADD COLUMN parent_id INT NULL;
ALTER TABLE recipes ADD INDEX idx_household_id (household_id);
ALTER TABLE recipes ADD INDEX idx_parent_id (parent_id);

-- Task 2.4: Add household ownership to ingredients and recipe_ingredients
-- Add parent tracking to recipe_ingredients (no household_id needed - ownership flows from recipes)
ALTER TABLE recipe_ingredients ADD COLUMN parent_id INT NULL;
ALTER TABLE recipe_ingredients ADD INDEX idx_parent_id (parent_id);

-- Add household ownership to ingredients
ALTER TABLE ingredients ADD COLUMN household_id INT;
ALTER TABLE ingredients ADD COLUMN parent_id INT NULL;
ALTER TABLE ingredients ADD INDEX idx_household_id (household_id);
ALTER TABLE ingredients ADD INDEX idx_parent_id (parent_id);

-- Task 2.5: Add household scope to private data tables
-- Add household scope to plans (meal planning)
ALTER TABLE plans ADD COLUMN household_id INT;
ALTER TABLE plans ADD INDEX idx_household_id (household_id);
ALTER TABLE plans ADD INDEX idx_household_week_year (household_id, week, year);

-- Add household scope to shopping_lists
ALTER TABLE shopping_lists ADD COLUMN household_id INT;
ALTER TABLE shopping_lists ADD INDEX idx_household_id (household_id);
ALTER TABLE shopping_lists ADD INDEX idx_household_week_year (household_id, week, year);

-- =============================================================================
-- PHASE 3: DATA MIGRATION (Tasks 3.1, 3.2, 3.3)
-- =============================================================================

-- Task 3.1: Create Spencer household and assign users
INSERT INTO households (name) VALUES ('Spencer');
SET @spencer_household_id = LAST_INSERT_ID();

-- Assign all existing users to Spencer household
UPDATE users SET household_id = @spencer_household_id;

-- Task 3.2: Assign household ownership to all resources
-- Spencer owns all existing collections, recipes, and ingredients
UPDATE collections SET household_id = @spencer_household_id, public = 0;
-- Make collection_id=1 public by default (Spencer's essentials)
UPDATE collections SET public = 1 WHERE id = 1;
UPDATE recipes SET household_id = @spencer_household_id;
UPDATE ingredients SET household_id = @spencer_household_id;
UPDATE plans SET household_id = @spencer_household_id;
UPDATE shopping_lists SET household_id = @spencer_household_id;

-- Task 3.3: Populate junction tables with existing relationships
-- Migrate existing recipe-collection relationships to junction table
INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
SELECT collection_id, id, NOW() 
FROM recipes 
WHERE collection_id IS NOT NULL;

-- Auto-subscribe all households to collection_id=1 (Spencer's essentials)
INSERT INTO collection_subscriptions (household_id, collection_id)
SELECT h.id, 1 FROM households h
WHERE 1 IN (SELECT id FROM collections WHERE id = 1);

-- =============================================================================
-- PHASE 4: ADD FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add foreign key constraints after data migration
ALTER TABLE users ADD CONSTRAINT fk_users_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE collections ADD CONSTRAINT fk_collections_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE collections ADD CONSTRAINT fk_collections_parent 
    FOREIGN KEY (parent_id) REFERENCES collections(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE recipes ADD CONSTRAINT fk_recipes_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE recipes ADD CONSTRAINT fk_recipes_parent 
    FOREIGN KEY (parent_id) REFERENCES recipes(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE recipe_ingredients ADD CONSTRAINT fk_recipe_ingredients_parent 
    FOREIGN KEY (parent_id) REFERENCES recipe_ingredients(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE ingredients ADD CONSTRAINT fk_ingredients_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE ingredients ADD CONSTRAINT fk_ingredients_parent 
    FOREIGN KEY (parent_id) REFERENCES ingredients(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE plans ADD CONSTRAINT fk_plans_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE shopping_lists ADD CONSTRAINT fk_shopping_lists_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- FINAL STEP: MAKE COLUMNS NOT NULL AFTER DATA MIGRATION
-- =============================================================================

-- Make household_id columns NOT NULL after data is populated
ALTER TABLE users MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE collections MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE recipes MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE ingredients MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE plans MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE shopping_lists MODIFY COLUMN household_id INT NOT NULL;