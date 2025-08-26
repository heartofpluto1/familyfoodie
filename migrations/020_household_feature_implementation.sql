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
-- NOTE: Keep collection_id for now - we'll drop it after data migration
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
-- PHASE 4: REMOVE OLD SCHEMA (After Data Migration)
-- =============================================================================

-- Now safe to drop collection_id from recipes since data is migrated to junction table
ALTER TABLE recipes DROP FOREIGN KEY fk_recipes_collection;
ALTER TABLE recipes DROP COLUMN collection_id;

-- =============================================================================
-- PHASE 5: ADD FOREIGN KEY CONSTRAINTS
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
-- PHASE 7: STORED PROCEDURES & TRIGGERS (Tasks 4.1, 4.2)
-- =============================================================================

-- Task 4.1: Implement enhanced cascade copy stored procedures

DELIMITER $$

-- Original copy-on-write procedure for recipes
CREATE PROCEDURE CopyRecipeForEdit(
    IN p_recipe_id INT,
    IN p_household_id INT,
    OUT p_new_recipe_id INT
)
BEGIN
    DECLARE v_recipe_household INT;
    
    -- Check if recipe is already owned by this household
    SELECT household_id INTO v_recipe_household 
    FROM recipes WHERE id = p_recipe_id;
    
    IF v_recipe_household = p_household_id THEN
        -- Already owns it, no copy needed
        SET p_new_recipe_id = p_recipe_id;
    ELSE
        -- Copy recipe for this household
        INSERT INTO recipes (name, prepTime, cookTime, description, duplicate, season_id, 
                            primaryType_id, secondaryType_id, public, url_slug, 
                            image_filename, pdf_filename, household_id, parent_id)
        SELECT name, prepTime, cookTime, description, duplicate, season_id, 
               primaryType_id, secondaryType_id, public, url_slug,
               image_filename, pdf_filename, p_household_id, id
        FROM recipes WHERE id = p_recipe_id;
        
        SET p_new_recipe_id = LAST_INSERT_ID();
        
        -- Copy all recipe_ingredients
        INSERT INTO recipe_ingredients (quantity, ingredient_id, recipe_id, preperation_id, 
                                      primaryIngredient, quantity4, quantityMeasure_id, parent_id)
        SELECT quantity, ingredient_id, p_new_recipe_id, preperation_id,
               primaryIngredient, quantity4, quantityMeasure_id, id
        FROM recipe_ingredients WHERE recipe_id = p_recipe_id;
        
        -- Update junction table to reference new recipe
        UPDATE collection_recipes 
        SET recipe_id = p_new_recipe_id
        WHERE collection_id IN (
            SELECT id FROM collections WHERE household_id = p_household_id
        ) AND recipe_id = p_recipe_id;
    END IF;
END$$

-- Original copy-on-write procedure for ingredients
CREATE PROCEDURE CopyIngredientForEdit(
    IN p_ingredient_id INT,
    IN p_household_id INT,
    OUT p_new_ingredient_id INT
)
BEGIN
    DECLARE v_ingredient_household INT;
    
    -- Check if ingredient is already owned by this household
    SELECT household_id INTO v_ingredient_household 
    FROM ingredients WHERE id = p_ingredient_id;
    
    IF v_ingredient_household = p_household_id THEN
        -- Already owns it, no copy needed
        SET p_new_ingredient_id = p_ingredient_id;
    ELSE
        -- Copy ingredient for this household
        INSERT INTO ingredients (name, fresh, supermarketCategory_id, cost, stockcode, 
                               public, pantryCategory_id, household_id, parent_id)
        SELECT name, fresh, supermarketCategory_id, cost, stockcode, 
               public, pantryCategory_id, p_household_id, id
        FROM ingredients WHERE id = p_ingredient_id;
        
        SET p_new_ingredient_id = LAST_INSERT_ID();
        
        -- Update all recipe_ingredients in household's recipes to use new ingredient
        UPDATE recipe_ingredients ri
        JOIN recipes r ON ri.recipe_id = r.id
        SET ri.ingredient_id = p_new_ingredient_id
        WHERE r.household_id = p_household_id 
        AND ri.ingredient_id = p_ingredient_id;
    END IF;
END$$

-- Enhanced cascade copy procedure that handles collection context
CREATE PROCEDURE CascadeCopyWithContext(
    IN p_user_household_id INT,
    IN p_collection_id INT, 
    IN p_recipe_id INT,
    OUT p_new_collection_id INT,
    OUT p_new_recipe_id INT,
    OUT p_actions_taken VARCHAR(255)
)
BEGIN
    DECLARE v_collection_household INT;
    DECLARE v_recipe_household INT;
    DECLARE v_actions VARCHAR(255) DEFAULT '';
    
    -- Check collection ownership
    SELECT household_id INTO v_collection_household 
    FROM collections WHERE id = p_collection_id;
    
    -- Check recipe ownership
    SELECT household_id INTO v_recipe_household 
    FROM recipes WHERE id = p_recipe_id;
    
    SET p_new_collection_id = p_collection_id;
    SET p_new_recipe_id = p_recipe_id;
    
    -- Copy collection if not owned by user's household
    IF v_collection_household != p_user_household_id THEN
        -- Copy collection using junction table approach
        INSERT INTO collections (title, subtitle, filename, filename_dark, household_id, parent_id, public)
        SELECT CONCAT(title, ' (Copy)'), subtitle, filename, filename_dark, p_user_household_id, id, 0
        FROM collections WHERE id = p_collection_id;
        
        SET p_new_collection_id = LAST_INSERT_ID();
        SET v_actions = CONCAT(v_actions, 'collection_copied,');
        
        -- Copy junction table entries to new collection
        INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
        SELECT p_new_collection_id, cr.recipe_id, NOW()
        FROM collection_recipes cr
        WHERE cr.collection_id = p_collection_id;
        
        -- Unsubscribe from original collection since we now have our own copy
        DELETE FROM collection_subscriptions 
        WHERE household_id = p_user_household_id AND collection_id = p_collection_id;
        SET v_actions = CONCAT(v_actions, 'unsubscribed_from_original,');
    END IF;
    
    -- Copy recipe if not owned by user's household
    IF v_recipe_household != p_user_household_id THEN
        CALL CopyRecipeForEdit(p_recipe_id, p_user_household_id, p_new_recipe_id);
        SET v_actions = CONCAT(v_actions, 'recipe_copied,');
        
        -- Update junction table to point to new recipe in user's collection
        UPDATE collection_recipes 
        SET recipe_id = p_new_recipe_id 
        WHERE collection_id = p_new_collection_id AND recipe_id = p_recipe_id;
    END IF;
    
    SET p_actions_taken = v_actions;
END$$

-- Enhanced ingredient copy that also handles collection/recipe context
CREATE PROCEDURE CascadeCopyIngredientWithContext(
    IN p_user_household_id INT,
    IN p_collection_id INT,
    IN p_recipe_id INT, 
    IN p_ingredient_id INT,
    OUT p_new_collection_id INT,
    OUT p_new_recipe_id INT,
    OUT p_new_ingredient_id INT,
    OUT p_actions_taken VARCHAR(255)
)
BEGIN
    -- First ensure collection and recipe are owned/copied
    CALL CascadeCopyWithContext(p_user_household_id, p_collection_id, p_recipe_id, 
                                p_new_collection_id, p_new_recipe_id, p_actions_taken);
    
    -- Then handle ingredient copying
    CALL CopyIngredientForEdit(p_ingredient_id, p_user_household_id, p_new_ingredient_id);
    
    IF p_new_ingredient_id != p_ingredient_id THEN
        SET p_actions_taken = CONCAT(p_actions_taken, 'ingredient_copied');
    END IF;
END$$

DELIMITER ;

-- Task 4.2: Create cleanup triggers for orphaned resources
DELIMITER $$

CREATE TRIGGER cleanup_after_recipe_delete 
AFTER DELETE ON recipes FOR EACH ROW
BEGIN
    -- Clean up recipe_ingredients for this recipe
    DELETE FROM recipe_ingredients 
    WHERE recipe_id = OLD.id;
    
    -- Clean up orphaned household-owned ingredients
    -- (ingredients only used by the deleted recipe)
    DELETE i FROM ingredients i
    WHERE i.household_id = OLD.household_id
    AND i.id NOT IN (
        SELECT DISTINCT ri.ingredient_id 
        FROM recipe_ingredients ri
        JOIN recipes r ON ri.recipe_id = r.id
        WHERE r.household_id = OLD.household_id
        AND r.id != OLD.id
    );
END$$

DELIMITER ;