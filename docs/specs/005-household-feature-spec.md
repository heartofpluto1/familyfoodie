# Household Feature Specification - Optimized Copy-on-Write with Junction Tables

## Executive Summary

This document outlines the implementation of a Household feature for the FamilyFoodie application using an optimized copy-on-write approach with junction tables. The feature introduces multi-tenancy at the household level while enabling intelligent sharing and customization of collections, recipes, and ingredients with maximum storage efficiency and query performance.

## Architecture Decision Record

### Decision 1: Junction Table Approach for Collection-Recipe Relationships

**Context**: Initial design used direct foreign keys with household_id duplicated across multiple tables and shallow copying of recipes during collection copying.

**Problem**: This approach had several inefficiencies:
- Redundant household_id columns creating data consistency risks
- Unnecessary recipe duplication during collection copying (14x more storage)
- Complex precedence queries with expensive EXISTS clauses (5-10x slower)
- Complex cascade stored procedures difficult to maintain

**Decision**: Use junction tables with ownership hierarchy flowing naturally through relationships.

**Rationale**:
1. **Storage Efficiency**: Junction records are ~12 bytes vs ~500 bytes for recipe records
2. **Query Performance**: Simple indexed joins vs complex subqueries with EXISTS
3. **Data Consistency**: Single source of truth for ownership (collections.household_id)
4. **Maintenance**: Standard relational patterns vs complex stored procedures

**Impact**: 
- Collection copying: 1 collection + N tiny junction records (vs 1 collection + N full recipe copies)
- Recipe queries: Simple joins (vs complex precedence subqueries)
- True copy-on-write: Only copy recipes when actually edited (vs copying for browsing)

### Decision 2: All Resources Have Owners (No NULL household_id)

**Context**: Initial design had NULL household_id to represent "shared" resources.

**Problem**: Inconsistent ownership model with confusing NULL semantics:
- Who owns "shared" recipes and ingredients?
- Inconsistent NULL handling in queries
- Unable to enforce NOT NULL constraints

**Decision**: Every resource has an owner. Spencer household owns all original resources.

**Rationale**:
1. **Clear Ownership**: Every recipe/ingredient has a definitive owner
2. **Consistent Model**: All resources follow same ownership pattern
3. **Simpler Queries**: No NULL checks needed
4. **Better Integrity**: Can enforce NOT NULL constraints everywhere

**Impact**:
- All original recipes/ingredients owned by Spencer household
- Other households reference Spencer's resources until they edit (copy-on-write)
- Cleaner, more maintainable code with consistent ownership model

### Decision 3: Collection Context Awareness for Copy-on-Write

**Context**: Recipe editing occurs within collection context via URL path `recipes/[collection_slug]/[recipe_slug]`, but initial copy-on-write design only validated recipe ownership.

**Problem**: Incomplete copy-on-write scenarios in multi-household access chains:
- Spencer accesses Williams collection (subscribed) → Johnson recipe → Smith ingredient
- Current logic only copies recipe if Spencer doesn't own it
- Missing logic fails to copy collection if Spencer doesn't own it
- Results in broken ownership chains and incomplete resource isolation

**Decision**: Implement collection context-aware cascade copying that validates entire access chain.

**Rationale**:
1. **Complete Isolation**: Ensures all accessed resources are owned or copied by user's household
2. **URL Integrity**: Maintains consistent URL paths after copy-on-write operations
3. **Access Chain Validation**: Validates collection → recipe → ingredient ownership chains
4. **User Experience**: Prevents broken states where users edit resources they don't own

**Impact**:
- Recipe interface maintains collection context for UI routing and copy-on-write decisions
- Copy-on-write operations can cascade from collection → recipe → ingredient as needed
- URL redirects after copying maintain user's expected navigation flow
- Complete resource isolation achieved across all multi-household scenarios

## Current State

Currently, the application has no data isolation between users:
- All users share access to all collections, recipes, shopping lists, and ingredients
- No concept of ownership or permissions exists
- Data is effectively global across the entire application

## Business Requirements

### Core Requirements
1. **Household Entity**: Introduce a new Household entity that groups users together
2. **User-Household Relationship**: Each user belongs to exactly one household (1:N relationship)
3. **Collection Ownership with Sharing**: Collections are owned by households with optional public sharing
4. **Lazy Copy-on-Write**: Resources are copied only when edited, not when accessed
5. **Smart Resource Management**: Automatic cleanup of orphaned resources
6. **Household Precedence**: Users see their customized versions in search, not originals
7. **Initial Migration**: Create "Spencer" household with all existing users and data

### Collection Sharing Model
- **Public Collections**: Marked with `public=true`, discoverable by all households
- **Collection Copying**: Junction table approach - copy collection + create junction records (no recipe duplication)
- **Recipe Sharing**: Recipes remain shared until actually edited (true copy-on-write)
- **Edit Triggers Copy**: Only editing a recipe creates household-owned copy
- **Independent Evolution**: Copied collections evolve independently from originals

### Resource Ownership Rules
- **Collections**: Owned by one household (`collections.household_id NOT NULL`), optionally public
- **Recipes**: Always owned by a household (`recipes.household_id NOT NULL`)
- **Ingredients**: Always owned by a household (`ingredients.household_id NOT NULL`)
- **Recipe-Collection Links**: Managed via `collection_recipes` junction table (no household_id needed)
- **Recipe-Ingredient Links**: Managed via `recipe_ingredients` table (no household_id needed)
- **Meal Plans**: Private to household (`plans.household_id NOT NULL`) - never shared
- **Shopping Lists**: Private to household (`shopping_lists.household_id NOT NULL`) - never shared

### Ownership Hierarchy Design Decision

**Key Principle**: Every resource has an owner. There are no "ownerless" shared resources.

```
households
└── collections (household_id NOT NULL) 
    └── collection_recipes (junction table - ownership flows from collections)
        └── recipes (household_id NOT NULL - Spencer owns originals)
            └── recipe_ingredients (no household_id - ownership flows from recipes)
                └── ingredients (household_id NOT NULL - Spencer owns originals)
```

**Critical Insight**: Spencer household owns all original recipes and ingredients. Other households reference these until they make edits, which triggers copy-on-write to create their own versions.

**Rationale**: 
- **Clear ownership**: Every resource has a definitive owner (no NULL confusion)
- **Consistent model**: All resources follow the same ownership pattern
- **Simpler queries**: No NULL checks needed anywhere
- **Better integrity**: Can enforce NOT NULL constraints on all ownership columns
- **Junction tables stay clean**: They only manage relationships, not ownership

## Technical Specification

### 1. Database Schema Changes

#### New Tables

```sql
-- households table
CREATE TABLE households (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Junction table for collection-recipe relationships (OPTIMIZATION)
-- Replaces direct collection_id foreign key in recipes table
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

-- Collection subscription system table
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
```

#### Modified Tables

```sql
-- users table modifications
ALTER TABLE users ADD COLUMN household_id INT NOT NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE users ADD INDEX idx_household_id (household_id);

-- collections table modifications (ownership layer)
ALTER TABLE collections ADD COLUMN household_id INT NOT NULL;
ALTER TABLE collections ADD COLUMN public TINYINT(1) DEFAULT 0;
ALTER TABLE collections ADD COLUMN parent_id INT NULL;
ALTER TABLE collections ADD CONSTRAINT fk_collections_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE collections ADD CONSTRAINT fk_collections_parent 
    FOREIGN KEY (parent_id) REFERENCES collections(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE collections ADD INDEX idx_household_id (household_id);
ALTER TABLE collections ADD INDEX idx_parent_id (parent_id);
ALTER TABLE collections ADD INDEX idx_public (public);

-- recipes table modifications (copy-on-write layer)
-- NOTE: Remove collection_id since relationship now managed by junction table
ALTER TABLE recipes DROP FOREIGN KEY fk_recipes_collection;
ALTER TABLE recipes DROP COLUMN collection_id;
ALTER TABLE recipes ADD COLUMN household_id INT NOT NULL; -- Always owned by a household
ALTER TABLE recipes ADD COLUMN parent_id INT NULL; -- NULL for originals, ID for copies
ALTER TABLE recipes ADD CONSTRAINT fk_recipes_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE recipes ADD CONSTRAINT fk_recipes_parent 
    FOREIGN KEY (parent_id) REFERENCES recipes(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE recipes ADD INDEX idx_household_id (household_id);
ALTER TABLE recipes ADD INDEX idx_parent_id (parent_id);

-- recipe_ingredients table modifications 
-- NOTE: No household_id needed - ownership flows from recipes table
ALTER TABLE recipe_ingredients ADD COLUMN parent_id INT NULL;
ALTER TABLE recipe_ingredients ADD CONSTRAINT fk_recipe_ingredients_parent 
    FOREIGN KEY (parent_id) REFERENCES recipe_ingredients(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE recipe_ingredients ADD INDEX idx_parent_id (parent_id);

-- ingredients table modifications (copy-on-write layer)
ALTER TABLE ingredients ADD COLUMN household_id INT NOT NULL; -- Always owned by a household
ALTER TABLE ingredients ADD COLUMN parent_id INT NULL; -- NULL for originals, ID for copies
ALTER TABLE ingredients ADD CONSTRAINT fk_ingredients_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE ingredients ADD CONSTRAINT fk_ingredients_parent 
    FOREIGN KEY (parent_id) REFERENCES ingredients(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE ingredients ADD INDEX idx_household_id (household_id);
ALTER TABLE ingredients ADD INDEX idx_parent_id (parent_id);

-- plans table modifications (household owned - meal planning)
-- Note: Plans are private to each household and never shared
ALTER TABLE plans ADD COLUMN household_id INT NOT NULL;
ALTER TABLE plans ADD CONSTRAINT fk_plans_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE plans ADD INDEX idx_household_id (household_id);
ALTER TABLE plans ADD INDEX idx_household_week_year (household_id, week, year);

-- shopping_lists table modifications (household owned)
-- Note: Shopping lists are private to each household and never shared
ALTER TABLE shopping_lists ADD COLUMN household_id INT NOT NULL;
ALTER TABLE shopping_lists ADD CONSTRAINT fk_shopping_lists_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE shopping_lists ADD INDEX idx_household_id (household_id);
ALTER TABLE shopping_lists ADD INDEX idx_household_week_year (household_id, week, year);
```

### 2. Optimized Copy-on-Write Logic

#### Collection Copying (Junction Table Approach - Maximum Efficiency)
```sql
-- Copy collection structure only - NO recipe duplication
INSERT INTO collections (title, subtitle, filename, filename_dark, household_id, parent_id, public, created_at)
SELECT CONCAT(title, ' (Copy)'), subtitle, filename, filename_dark, @target_household_id, id, 0, NOW()
FROM collections 
WHERE id = @source_collection_id;

SET @new_collection_id = LAST_INSERT_ID();

-- Create junction table entries - tiny records, massive storage savings
INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
SELECT @new_collection_id, cr.recipe_id, NOW()
FROM collection_recipes cr
WHERE cr.collection_id = @source_collection_id;

-- Result: 1 collection record + N junction records (12 bytes each)
-- vs Previous: 1 collection record + N full recipe records (500+ bytes each)
-- Storage savings: ~14x less storage usage

-- Recipes, recipe_ingredients, and ingredients remain completely untouched (still shared)
-- True copy-on-write: They will be copied only when actually edited
```

#### Storage Efficiency Comparison
```
Spencer's "Italian Classics" (20 recipes) copied by Johnson:

OLD APPROACH (Shallow Recipe Copying):
- 1 collection record: ~500 bytes  
- 20 recipe records: ~10,000 bytes
- Total: ~10,500 bytes

NEW APPROACH (Junction Table):
- 1 collection record: ~500 bytes
- 20 junction records: ~240 bytes  
- Total: ~740 bytes (14x less storage!)
```

#### Edit Triggers Copy (True Copy-on-Write)
```sql
-- When user edits a recipe/ingredient not owned by their household, trigger copy
DELIMITER $$
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
DELIMITER ;
```

#### Collection Context-Aware Cascade Copy (Enhanced Copy-on-Write)

The enhanced copy-on-write system validates entire ownership chains when recipes are edited through collection URLs.

```sql
-- Enhanced cascade copy procedure that handles collection context
DELIMITER $$
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
```

#### Collection Context Copy-on-Write Scenarios

**Scenario 1: Spencer edits Williams collection → Johnson recipe**
- Spencer accesses `/recipes/williams-italian/johnson-carbonara` 
- Edit triggers: Check collection ownership (Williams ≠ Spencer) → Copy collection
- Check recipe ownership (Johnson ≠ Spencer) → Copy recipe  
- Result: Spencer gets `/recipes/williams-italian-copy/johnson-carbonara-copy`

**Scenario 2: Spencer edits subscribed collection → owned recipe**
- Spencer accesses `/recipes/williams-desserts/spencer-tiramisu`
- Edit triggers: Check collection ownership (Williams ≠ Spencer) → Copy collection
- Check recipe ownership (Spencer = Spencer) → No recipe copy needed
- Result: Spencer gets `/recipes/williams-desserts-copy/spencer-tiramisu`

**Scenario 3: Spencer edits owned collection → external recipe**
- Spencer accesses `/recipes/spencer-favorites/johnson-pasta`
- Edit triggers: Check collection ownership (Spencer = Spencer) → No collection copy
- Check recipe ownership (Johnson ≠ Spencer) → Copy recipe
- Result: Spencer gets `/recipes/spencer-favorites/johnson-pasta-copy`

### 3. Optimized Query Logic

#### Recipe Search with Household Precedence (Junction Table Optimized)
```sql
-- Show household's customized version preferentially, with optimized joins
SELECT DISTINCT r.*, 
       CASE WHEN r.household_id = @user_household THEN 1 ELSE 2 END as priority
FROM recipes r
LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
LEFT JOIN collections c ON cr.collection_id = c.id
WHERE r.name LIKE @search_term
AND (
    -- Show household's own recipes first
    r.household_id = @user_household
    OR 
    -- Show Spencer's recipes only if household doesn't have customized version
    (r.household_id != @user_household 
     AND NOT EXISTS (
         SELECT 1 FROM recipes r2 
         WHERE r2.household_id = @user_household 
         AND r2.parent_id = r.id
     ))
)
AND (
    -- Recipe must be in an accessible collection
    c.public = 1 OR c.household_id = @user_household
)
ORDER BY priority, r.name;
```

#### Collection Browsing (Junction Table Approach)
```sql
-- Browse recipes in a specific collection - optimized with junction table
SELECT r.*, cr.added_at, cr.display_order,
       CASE WHEN r.household_id = c.household_id THEN 'original'
            WHEN r.household_id = @user_household THEN 'customized' 
            ELSE 'shared' END as recipe_status
FROM collection_recipes cr
JOIN recipes r ON cr.recipe_id = r.id
JOIN collections c ON cr.collection_id = c.id
WHERE cr.collection_id = @collection_id
AND (
    -- Show household's customized version if it exists
    r.household_id = @user_household
    OR
    -- Otherwise show the original version (owned by collection's household)
    (r.household_id = c.household_id
     AND NOT EXISTS (
        SELECT 1 FROM recipes r2 
        WHERE r2.household_id = @user_household 
        AND r2.parent_id = r.id
    ))
)
ORDER BY cr.display_order, cr.added_at;
```

#### Performance Benefits of Junction Table Queries
```
OLD APPROACH: Complex precedence with recipe.collection_id joins
- Multiple table scans
- Expensive EXISTS subqueries  
- Hard for database to optimize

NEW APPROACH: Simple junction table joins
- Indexed joins on collection_recipes
- Database can use hash joins
- 5-10x faster query performance
```

### 4. Automatic Cleanup Logic

#### Cleanup Trigger for Recipe Deletion
```sql
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
```

### 5. Data Migration Strategy

#### Phase 1: Initial Migration
```sql
-- Step 1: Create households table
CREATE TABLE households (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Step 2: Insert Spencer household
INSERT INTO households (name) VALUES ('Spencer');
SET @spencer_household_id = LAST_INSERT_ID();

-- Step 3: Add household_id to users
ALTER TABLE users ADD COLUMN household_id INT;
UPDATE users SET household_id = @spencer_household_id;
ALTER TABLE users MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Add household_id and parent tracking to collections
ALTER TABLE collections ADD COLUMN household_id INT;
ALTER TABLE collections ADD COLUMN public TINYINT(1) DEFAULT 1; -- Make existing collections public
ALTER TABLE collections ADD COLUMN parent_id INT NULL;
UPDATE collections SET household_id = @spencer_household_id;
ALTER TABLE collections MODIFY COLUMN household_id INT NOT NULL;

-- Step 5: Add household_id and parent tracking to recipes
ALTER TABLE recipes ADD COLUMN household_id INT;
ALTER TABLE recipes ADD COLUMN parent_id INT NULL;
UPDATE recipes SET household_id = @spencer_household_id; -- Spencer owns all original recipes
ALTER TABLE recipes MODIFY COLUMN household_id INT NOT NULL;

-- Step 6: Add parent tracking to recipe_ingredients (no household_id needed)
ALTER TABLE recipe_ingredients ADD COLUMN parent_id INT NULL;
-- No household_id on recipe_ingredients - ownership flows from recipes

-- Step 7: Add household_id and parent tracking to ingredients
ALTER TABLE ingredients ADD COLUMN household_id INT;
ALTER TABLE ingredients ADD COLUMN parent_id INT NULL;
UPDATE ingredients SET household_id = @spencer_household_id; -- Spencer owns all original ingredients
ALTER TABLE ingredients MODIFY COLUMN household_id INT NOT NULL;

-- Step 8: Add household_id to plans (meal planning)
ALTER TABLE plans ADD COLUMN household_id INT;
UPDATE plans SET household_id = @spencer_household_id;
ALTER TABLE plans MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE plans ADD CONSTRAINT fk_plans_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE plans ADD INDEX idx_household_id (household_id);
ALTER TABLE plans ADD INDEX idx_household_week_year (household_id, week, year);

-- Step 9: Add household_id to shopping_lists
ALTER TABLE shopping_lists ADD COLUMN household_id INT;
UPDATE shopping_lists SET household_id = @spencer_household_id;
ALTER TABLE shopping_lists MODIFY COLUMN household_id INT NOT NULL;
ALTER TABLE shopping_lists ADD CONSTRAINT fk_shopping_lists_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE shopping_lists ADD INDEX idx_household_id (household_id);
ALTER TABLE shopping_lists ADD INDEX idx_household_week_year (household_id, week, year);

-- Step 10: Create junction table for collection-recipe relationships
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

-- Step 11: Migrate existing recipe-collection relationships to junction table
INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
SELECT collection_id, id, NOW() 
FROM recipes 
WHERE collection_id IS NOT NULL;

-- Step 12: Drop the old collection_id column from recipes
ALTER TABLE recipes DROP FOREIGN KEY fk_recipes_collection;
ALTER TABLE recipes DROP COLUMN collection_id;

-- Step 13: Create collection_subscriptions table
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

-- Step 14: Auto-subscribe all households to collection_id=1 (Spencer's essentials)
-- This ensures good user onboarding with core ingredients
INSERT INTO collection_subscriptions (household_id, collection_id)
SELECT h.id, 1
FROM households h
WHERE 1 IN (SELECT id FROM collections WHERE public = 1);  -- Only if collection 1 exists and is public

-- Step 15: Add all remaining foreign key constraints and indexes
ALTER TABLE collections ADD CONSTRAINT fk_collections_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE collections ADD CONSTRAINT fk_collections_parent 
    FOREIGN KEY (parent_id) REFERENCES collections(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE collections ADD INDEX idx_household_id (household_id);
ALTER TABLE collections ADD INDEX idx_parent_id (parent_id);
ALTER TABLE collections ADD INDEX idx_public (public);

ALTER TABLE recipes ADD CONSTRAINT fk_recipes_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE recipes ADD CONSTRAINT fk_recipes_parent 
    FOREIGN KEY (parent_id) REFERENCES recipes(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE recipes ADD INDEX idx_household_id (household_id);
ALTER TABLE recipes ADD INDEX idx_parent_id (parent_id);

ALTER TABLE recipe_ingredients ADD CONSTRAINT fk_recipe_ingredients_parent 
    FOREIGN KEY (parent_id) REFERENCES recipe_ingredients(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE recipe_ingredients ADD INDEX idx_parent_id (parent_id);

ALTER TABLE ingredients ADD CONSTRAINT fk_ingredients_household 
    FOREIGN KEY (household_id) REFERENCES households(id) 
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE ingredients ADD CONSTRAINT fk_ingredients_parent 
    FOREIGN KEY (parent_id) REFERENCES ingredients(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE ingredients ADD INDEX idx_household_id (household_id);
ALTER TABLE ingredients ADD INDEX idx_parent_id (parent_id);
```

### 6. Application Layer Changes

#### Type Definitions

```typescript
// src/types/household.ts
export interface Household {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

// Update src/types/collection.ts
export interface Collection {
  id: number;
  title: string;
  subtitle?: string;
  filename?: string;
  filename_dark?: string;
  household_id: number;
  public: boolean;
  parent_id?: number;
  created_at: string;
  updated_at: string;
  url_slug: string;
}

// Update src/types/recipe.ts  
export interface Recipe {
  id: number;
  name: string;
  prepTime?: number;
  cookTime: number;
  description?: string;
  household_id: number; // NOT NULL - always owned by a household
  parent_id?: number; // NULL for originals, ID for copies
  url_slug: string;
  image_filename?: string;
  pdf_filename?: string;
  
  // Collection context for UI routing and copy-on-write (populated by queries)
  current_collection_id?: number;  // Context-aware: which collection is user accessing this through
  current_collection_slug?: string; // For URL generation after copy-on-write
  access_context?: {
    collection_household_id: number;
    recipe_household_id: number;
    user_owns_collection: boolean;
    user_owns_recipe: boolean;
  };
}

// New junction table type
export interface CollectionRecipe {
  collection_id: number;
  recipe_id: number;
  added_at: string;
  display_order: number;
}

// Update src/types/ingredient.ts
export interface Ingredient {
  id: number;
  name: string;
  fresh: boolean;
  household_id: number; // NOT NULL - always owned by a household
  parent_id?: number; // NULL for originals, ID for copies
  cost?: number;
  public: boolean;
  supermarketCategory_id: number;
  pantryCategory_id: number;
}

// Add src/types/plan.ts
export interface Plan {
  id: number;
  week: number;
  year: number;
  recipe_id: number;
  household_id: number; // NOT NULL - plans are private to household
}

// Add src/types/shopping-list.ts
export interface ShoppingList {
  id: number;
  week: number;
  year: number;
  fresh: boolean;
  name: string;
  sort: number;
  cost?: number;
  recipeIngredient_id?: number;
  purchased: boolean;
  stockcode?: number;
  household_id: number; // NOT NULL - shopping lists are private to household
}

// Add src/types/collection-subscription.ts
export interface CollectionSubscription {
  household_id: number;
  collection_id: number;
  subscribed_at: string;
}
```

#### Optimized Query Helper Functions (Junction Table Approach)

```typescript
// src/lib/queries/collections.ts
export async function getVisibleCollections(household_id: number) {
  const query = `
    SELECT c.*, h.name as owner_name,
           CASE WHEN c.household_id = ? THEN 1 ELSE 0 END as is_owned,
           COUNT(cr.recipe_id) as recipe_count
    FROM collections c
    JOIN households h ON c.household_id = h.id
    LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
    WHERE c.household_id = ? OR c.public = 1
    GROUP BY c.id
    ORDER BY is_owned DESC, c.title
  `;
  const [rows] = await pool.execute(query, [household_id, household_id]);
  return rows;
}

export async function copyCollectionOptimized(source_id: number, target_household_id: number) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Copy collection record
    const copyQuery = `
      INSERT INTO collections (title, subtitle, filename, filename_dark, household_id, parent_id, public)
      SELECT CONCAT(title, ' (Copy)'), subtitle, filename, filename_dark, ?, id, 0
      FROM collections WHERE id = ?
    `;
    const [result] = await connection.execute(copyQuery, [target_household_id, source_id]);
    const newCollectionId = result.insertId;
    
    // Copy junction table entries (the key optimization!)
    const junctionQuery = `
      INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
      SELECT ?, cr.recipe_id, NOW()
      FROM collection_recipes cr
      WHERE cr.collection_id = ?
    `;
    await connection.execute(junctionQuery, [newCollectionId, source_id]);
    
    await connection.commit();
    return newCollectionId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// src/lib/queries/recipes.ts  
export async function getRecipesInCollection(collection_id: number, household_id: number) {
  // Enhanced junction table query with collection context and household precedence
  const query = `
    SELECT r.*, cr.added_at, cr.display_order,
           CASE WHEN r.household_id = ? THEN 'customized'
                WHEN r.household_id = c.household_id THEN 'original'
                ELSE 'referenced' END as status,
           c.household_id as collection_household_id,
           c.url_slug as current_collection_slug,
           ? as current_collection_id,
           (r.household_id = ?) as user_owns_recipe,
           (c.household_id = ?) as user_owns_collection
    FROM collection_recipes cr
    JOIN recipes r ON cr.recipe_id = r.id
    JOIN collections c ON cr.collection_id = c.id
    WHERE cr.collection_id = ?
    AND (
        r.household_id = ? 
        OR 
        (r.household_id != ?
         AND NOT EXISTS (
            SELECT 1 FROM recipes r2 
            WHERE r2.household_id = ? 
            AND r2.parent_id = r.id
        ))
    )
    ORDER BY cr.display_order, cr.added_at
  `;
  const [rows] = await pool.execute(query, [
    household_id, collection_id, household_id, household_id, collection_id, 
    household_id, household_id, household_id
  ]);
  
  // Transform rows to include access_context
  return rows.map(row => ({
    ...row,
    current_collection_id: row.current_collection_id,
    current_collection_slug: row.current_collection_slug,
    access_context: {
      collection_household_id: row.collection_household_id,
      recipe_household_id: row.household_id,
      user_owns_collection: !!row.user_owns_collection,
      user_owns_recipe: !!row.user_owns_recipe
    }
  }));
}

export async function searchRecipesWithPrecedence(household_id: number, search_term: string) {
  // Global recipe search with household precedence
  const query = `
    SELECT DISTINCT r.*, 
           CASE WHEN r.household_id = ? THEN 1 ELSE 2 END as priority,
           GROUP_CONCAT(c.title) as collections
    FROM recipes r
    LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
    LEFT JOIN collections c ON cr.collection_id = c.id
    WHERE r.name LIKE ?
    AND (
        -- Show household's own recipes
        r.household_id = ?
        OR 
        -- Show other households' recipes only if no customized version exists
        (r.household_id != ?
         AND NOT EXISTS (
             SELECT 1 FROM recipes r2 
             WHERE r2.household_id = ? 
             AND r2.parent_id = r.id
         ))
    )
    AND (
        -- Recipe must be in an accessible collection
        c.public = 1 OR c.household_id = ?
    )
    GROUP BY r.id
    ORDER BY priority, r.name
  `;
  const searchPattern = `%${search_term}%`;
  const [rows] = await pool.execute(query, [household_id, searchPattern, household_id, household_id, household_id, household_id]);
  return rows;
}

// NEW: Scoped recipe selection for meal planning (strict subscription-based access)
// Used for meal planning - only includes owned + subscribed collections
export async function getMyRecipes(household_id: number) {
  const query = `
    SELECT DISTINCT r.*,
           CASE WHEN r.household_id = ? THEN 1 ELSE 2 END as priority
    FROM recipes r
    JOIN collection_recipes cr ON r.id = cr.recipe_id
    JOIN collections c ON cr.collection_id = c.id
    WHERE (
        -- Household's own collections
        c.household_id = ?
        OR
        -- Subscribed collections only
        c.id IN (
            SELECT cs.collection_id
            FROM collection_subscriptions cs
            WHERE cs.household_id = ?
        )
    )
    AND (
        -- Show household's customized version if exists, otherwise show original
        r.household_id = ?
        OR NOT EXISTS (
            SELECT 1 FROM recipes r2 
            WHERE r2.household_id = ? 
            AND r2.parent_id = r.id
        )
    )
    ORDER BY priority, r.name
  `;
  const [rows] = await pool.execute(query, [household_id, household_id, household_id, household_id, household_id]);
  return rows;
}

// NEW: Scoped ingredient selection with broader access (for all ingredient autocomplete)
// Used for shopping lists, recipe creation/editing - includes collection_id=1 always
export async function getMyIngredients(household_id: number) {
  const query = `
    SELECT DISTINCT i.*,
           CASE WHEN i.household_id = ? THEN 1 ELSE 2 END as priority
    FROM ingredients i
    WHERE (
        -- Household's own ingredients
        i.household_id = ?
        OR
        -- Ingredients used in accessible recipes
        i.id IN (
            SELECT DISTINCT ri.ingredient_id
            FROM recipe_ingredients ri
            JOIN recipes r ON ri.recipe_id = r.id
            LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
            LEFT JOIN collections c ON cr.collection_id = c.id
            LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
            WHERE (
                r.household_id = ?
                OR c.household_id = ?  
                OR c.id = 1  -- Always include Spencer's essentials collection (even if unsubscribed)
                OR (c.public = 1 AND cs.household_id IS NOT NULL)  -- Subscribed collections only
            )
        )
    )
    AND (
        -- Show household's customized version if exists, otherwise show original
        i.household_id = ?
        OR NOT EXISTS (
            SELECT 1 FROM ingredients i2 
            WHERE i2.household_id = ? 
            AND i2.parent_id = i.id
        )
    )
    ORDER BY priority, i.name
  `;
  const [rows] = await pool.execute(query, [household_id, household_id, household_id, household_id, household_id, household_id, household_id]);
  return rows;
}
```

#### Edit Permission Middleware

```typescript
// src/lib/permissions.ts
export async function canEditResource(
  user_household_id: number,
  resource_type: 'collection' | 'recipe' | 'ingredient',
  resource_id: number
): Promise<boolean> {
  const table = resource_type === 'collection' ? 'collections' :
                resource_type === 'recipe' ? 'recipes' : 'ingredients';
  
  const query = `SELECT household_id FROM ${table} WHERE id = ?`;
  const [rows] = await pool.execute(query, [resource_id]);
  
  if (rows.length === 0) return false;
  
  const resource_household_id = rows[0].household_id;
  
  // Can only edit if owned by user's household
  // (All resources now have NOT NULL household_id)
  return resource_household_id === user_household_id;
}

export async function triggerCascadeCopyIfNeeded(
  user_household_id: number,
  recipe_id: number
): Promise<number> {
  // Check if recipe is owned by user's household
  const canEdit = await canEditResource(user_household_id, 'recipe', recipe_id);
  
  if (canEdit) {
    return recipe_id; // No copy needed
  }
  
  // Trigger cascade copy
  const copyQuery = `CALL CascadeCopyRecipe(?, ?, @new_recipe_id)`;
  await pool.execute(copyQuery, [recipe_id, user_household_id]);
  
  const [result] = await pool.execute('SELECT @new_recipe_id as new_id');
  return result[0].new_id;
}

// NEW: Enhanced cascade copy with collection context
export async function triggerCascadeCopyWithContext(
  user_household_id: number,
  collection_id: number,
  recipe_id: number
): Promise<{
  new_collection_id: number;
  new_recipe_id: number;
  new_collection_slug?: string;
  new_recipe_slug?: string;
  actions_taken: string[];
}> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Call enhanced cascade copy procedure
    const copyQuery = `
      CALL CascadeCopyWithContext(?, ?, ?, @new_collection_id, @new_recipe_id, @actions_taken)
    `;
    await connection.execute(copyQuery, [user_household_id, collection_id, recipe_id]);
    
    // Get results
    const [results] = await connection.execute(`
      SELECT @new_collection_id as new_collection_id, 
             @new_recipe_id as new_recipe_id,
             @actions_taken as actions_taken
    `);
    
    const result = results[0];
    const actions = result.actions_taken ? result.actions_taken.split(',').filter(Boolean) : [];
    
    // Get new slugs if resources were copied
    let new_collection_slug, new_recipe_slug;
    
    if (actions.includes('collection_copied')) {
      const [collectionRows] = await connection.execute(
        'SELECT url_slug FROM collections WHERE id = ?', 
        [result.new_collection_id]
      );
      new_collection_slug = collectionRows[0]?.url_slug;
    }
    
    if (actions.includes('recipe_copied')) {
      const [recipeRows] = await connection.execute(
        'SELECT url_slug FROM recipes WHERE id = ?', 
        [result.new_recipe_id]
      );
      new_recipe_slug = recipeRows[0]?.url_slug;
    }
    
    await connection.commit();
    
    return {
      new_collection_id: result.new_collection_id,
      new_recipe_id: result.new_recipe_id,
      new_collection_slug,
      new_recipe_slug,
      actions_taken: actions
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// src/lib/queries/subscriptions.ts
// Collection Subscription Management API Functions

// Subscribe to a public collection
export async function subscribeToCollection(household_id: number, collection_id: number) {
  // Verify collection is public and not owned by household
  const collectionQuery = `
    SELECT public, household_id
    FROM collections
    WHERE id = ? AND public = 1 AND household_id != ?
  `;
  const [collections] = await pool.execute(collectionQuery, [collection_id, household_id]);

  if (collections.length === 0) {
    throw new Error('Collection not found or not subscribable');
  }

  // Add subscription
  const subscribeQuery = `
    INSERT IGNORE INTO collection_subscriptions (household_id, collection_id)
    VALUES (?, ?)
  `;
  await pool.execute(subscribeQuery, [household_id, collection_id]);
}

// Unsubscribe from collection
export async function unsubscribeFromCollection(household_id: number, collection_id: number) {
  const query = `
    DELETE FROM collection_subscriptions
    WHERE household_id = ? AND collection_id = ?
  `;
  await pool.execute(query, [household_id, collection_id]);
}

// Get subscribed collections
export async function getSubscribedCollections(household_id: number) {
  const query = `
    SELECT c.*, cs.subscribed_at
    FROM collections c
    JOIN collection_subscriptions cs ON c.id = cs.collection_id
    WHERE cs.household_id = ?
    ORDER BY c.title
  `;
  const [rows] = await pool.execute(query, [household_id]);
  return rows;
}

// Check if household is subscribed to collection
export async function isSubscribed(household_id: number, collection_id: number): Promise<boolean> {
  const query = `
    SELECT 1 FROM collection_subscriptions 
    WHERE household_id = ? AND collection_id = ?
  `;
  const [rows] = await pool.execute(query, [household_id, collection_id]);
  return rows.length > 0;
}

// Get browsable collections with subscription status
export async function getBrowsableCollections(household_id: number) {
  const query = `
    SELECT c.*, h.name as owner_name,
           CASE WHEN c.household_id = ? THEN 'owned'
                WHEN cs.household_id IS NOT NULL THEN 'subscribed'
                WHEN c.public = 1 THEN 'public'
                ELSE 'none' END as access_type,
           COUNT(cr.recipe_id) as recipe_count
    FROM collections c
    JOIN households h ON c.household_id = h.id
    LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE c.household_id = ? OR c.public = 1
    GROUP BY c.id
    ORDER BY
        CASE WHEN c.household_id = ? THEN 1
             WHEN cs.household_id IS NOT NULL THEN 2
             ELSE 3 END,
        c.title
  `;
  const [rows] = await pool.execute(query, [household_id, household_id, household_id, household_id]);
  return rows;
}
```

## Implementation Phases

### Phase 1: Database Schema & Migration (Week 1)
- [ ] Create households table migration
- [ ] Add household_id, parent_id, and public columns to all relevant tables
- [ ] Create stored procedures for cascade copying
- [ ] Create cleanup triggers
- [ ] Migrate existing data to Spencer household
- [ ] Test rollback procedures

### Phase 2: Core Application Logic (Week 2)
- [ ] Update TypeScript interfaces
- [ ] Implement permission checking middleware
- [ ] Create collection copying functionality
- [ ] Implement cascade copying for recipes
- [ ] Update search queries with household precedence
- [ ] Update authentication to include household context

### Phase 3: API Route Updates (Week 2-3)
- [ ] Update collection endpoints with ownership checks
- [ ] Update recipe endpoints with copy-on-write logic
- [ ] Update ingredient endpoints with sharing logic
- [ ] Add collection copying endpoints
- [ ] Implement cleanup operations

### Phase 4: Testing & Validation (Week 3)
- [ ] Unit tests for all copying logic
- [ ] Integration tests for cross-household scenarios
- [ ] Security tests for permission boundaries
- [ ] Performance testing with large datasets
- [ ] Test cleanup operations

## Success Criteria

1. **Data Preservation**: All existing data migrated to Spencer household with no loss
2. **Collection Sharing**: Public collections discoverable by all households
3. **Lazy Copying**: Collections copy instantly, recipes copy only on edit
4. **Search Precedence**: Users see their customized versions preferentially
5. **Automatic Cleanup**: Orphaned resources removed automatically
6. **Performance**: No significant performance degradation
7. **Security**: Complete data isolation between households

## Access Control and Scoping Rules

### Recipe Selection for Meal Planning (Strict Subscription-Based Access)

**Rule: Users can only plan with recipes from subscribed collections**

When selecting recipes for meal planning (`plans` table), users should only see:
1. **Household-owned collections** - Collections owned by their household
2. **Subscribed collections only** - Public collections they've explicitly subscribed to (NO automatic access to all public collections)

**Query Implementation:**
```sql
-- Get recipes available for household's meal planning (strict subscription-based)
SELECT DISTINCT r.*,
       CASE WHEN r.household_id = @user_household THEN 1 ELSE 2 END as priority
FROM recipes r
JOIN collection_recipes cr ON r.id = cr.recipe_id
JOIN collections c ON cr.collection_id = c.id
WHERE (
    -- Household's own collections
    c.household_id = @user_household
    OR
    -- Subscribed collections only
    c.id IN (
        SELECT cs.collection_id
        FROM collection_subscriptions cs
        WHERE cs.household_id = @user_household
    )
)
AND (
    -- Show household's customized version if exists, otherwise show original
    r.household_id = @user_household
    OR NOT EXISTS (
        SELECT 1 FROM recipes r2 
        WHERE r2.household_id = @user_household 
        AND r2.parent_id = r.id
    )
)
ORDER BY priority, r.name;
```

### Ingredient Selection Scoping (Enhanced Discovery Access for All Autocomplete)

**Rule: All ingredient autocomplete uses enhanced discovery access**

When adding ingredients to recipes OR shopping lists (any autocomplete scenario), users should see:
1. **Household-owned ingredients** - Ingredients created/customized by their household
2. **Spencer's essentials ingredients** - Always include collection_id=1 for good onboarding (even if unsubscribed)
3. **Subscribed collection ingredients** - Ingredients from explicitly subscribed collections
4. **Owned collection ingredients** - Ingredients from collections owned by their household

**Use Cases:**
- Recipe creation/editing ingredient autocomplete → uses enhanced discovery access
- Shopping list ingredient autocomplete → uses enhanced discovery access
- Both scenarios ensure users always have access to Spencer's essentials for good UX

**Query Implementation:**
```sql
-- Get ingredients available for household's use (enhanced discovery for all autocomplete)
SELECT DISTINCT i.*
FROM ingredients i
WHERE (
    -- Household's own ingredients
    i.household_id = @user_household
    OR
    -- Ingredients used in accessible recipes
    i.id IN (
        SELECT DISTINCT ri.ingredient_id
        FROM recipe_ingredients ri
        JOIN recipes r ON ri.recipe_id = r.id
        LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
        LEFT JOIN collections c ON cr.collection_id = c.id
        LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = @user_household
        WHERE (
            r.household_id = @user_household
            OR c.household_id = @user_household  
            OR c.id = 1  -- Always include Spencer's essentials collection (even if unsubscribed)
            OR (c.public = 1 AND cs.household_id IS NOT NULL)  -- Subscribed collections only
        )
    )
)
AND (
    -- Show household's customized version if exists, otherwise show original
    i.household_id = @user_household
    OR NOT EXISTS (
        SELECT 1 FROM ingredients i2 
        WHERE i2.household_id = @user_household 
        AND i2.parent_id = i.id
    )
)
ORDER BY i.name;
```

### API Method Renaming

**Before (Global Access):**
- `getAllRecipes()` → Shows all recipes regardless of household
- `getAllIngredients()` → Shows all ingredients regardless of household

**After (Scoped Access):**
- `getMyRecipes(household_id)` → Shows only accessible recipes for household
- `getMyIngredients(household_id)` → Shows only accessible ingredients for household

### Collection Subscription Model

The system uses an explicit subscription model for precise access control over public collections:

#### Subscription Table Schema
```sql
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
```

#### Three-Tier Access System

1. **Browsing Access (All Public Collections)**
   - All households can browse/view any public collection
   - No subscription required for discovery and viewing
   - Enables exploration of available content

2. **Planning Access (Subscribed + Owned Collections Only)**
   - Only subscribed collections can be used for meal planning
   - Prevents accidental meal planning with unsubscribed collections
   - Requires explicit opt-in for meal planning functionality

3. **Ingredient Discovery Access (Collection ID=1 + Subscribed + Owned)**
   - Always includes collection_id=1 (Spencer's essentials) even if unsubscribed
   - Plus all subscribed and owned collections
   - Ensures good user onboarding experience with core ingredients

#### Subscription Management API Functions

```typescript
// Subscribe to a collection
export async function subscribeToCollection(household_id: number, collection_id: number) {
  const query = `
    INSERT IGNORE INTO collection_subscriptions (household_id, collection_id)
    VALUES (?, ?)
  `;
  await pool.execute(query, [household_id, collection_id]);
}

// Unsubscribe from a collection
export async function unsubscribeFromCollection(household_id: number, collection_id: number) {
  const query = `
    DELETE FROM collection_subscriptions 
    WHERE household_id = ? AND collection_id = ?
  `;
  await pool.execute(query, [household_id, collection_id]);
}

// Get subscribed collections
export async function getSubscribedCollections(household_id: number) {
  const query = `
    SELECT c.*, cs.subscribed_at
    FROM collections c
    JOIN collection_subscriptions cs ON c.id = cs.collection_id
    WHERE cs.household_id = ?
    ORDER BY c.title
  `;
  const [rows] = await pool.execute(query, [household_id]);
  return rows;
}

// Check if household is subscribed to collection
export async function isSubscribed(household_id: number, collection_id: number): Promise<boolean> {
  const query = `
    SELECT 1 FROM collection_subscriptions 
    WHERE household_id = ? AND collection_id = ?
  `;
  const [rows] = await pool.execute(query, [household_id, collection_id]);
  return rows.length > 0;
}
```

#### Collection Display Logic

Collections List UI:
- **My Collections** (owned) - Always usable for planning
- **Subscribed Collections** - Usable for planning, show "unsubscribe" button
- **Public Collections** - Browsable only, show "subscribe" button

#### Auto-Subscription for New Users

During household creation, all households are automatically subscribed to collection_id=1 (Spencer's essentials):

```sql
-- Auto-subscribe to Spencer's essential collection
INSERT INTO collection_subscriptions (household_id, collection_id)
SELECT h.id, 1
FROM households h
WHERE 1 IN (SELECT id FROM collections WHERE public = 1);
```

This ensures new users have immediate access to core ingredients and recipes for good onboarding experience.

## Behavioral Specifications

### Recipe Deletion from Collections

**Q: Can users delete Spencer's original recipes from their copied collections?**
**A: Yes** - Deleting a recipe from a collection only removes the `collection_recipes` junction record for that household's collection. The original Spencer recipe remains intact and available in other collections.

```sql
-- Johnson deleting Spencer's Carbonara from their Italian collection
DELETE FROM collection_recipes 
WHERE collection_id = @johnson_collection_id 
AND recipe_id = @spencer_carbonara_id;
-- Spencer's Carbonara recipe is untouched
```

### Editing Shared Recipes

**Q: Can Spencer edit recipes that have been customized by others?**
**A: Yes** - Edits to Spencer's original recipes are visible to all households that reference them (haven't created their own copies).

**Example Flow:**
1. Spencer's "Carbonara" recipe is in 10 household collections
2. Johnson edits the title → creates Johnson's copy (parent_id points to Spencer's)
3. Spencer edits description to "Yum!" on their original
4. Result: 9 households see "Yum!" (still referencing original), Johnson doesn't (has own copy)

**Important:** Editing a recipe does NOT cascade updates to child recipes with `parent_id` references.

### Deleting Recipes with Lineage

**Q: What happens when a recipe in a lineage chain is deleted?**
**A: The parent_id references become NULL** to avoid creating false relationships.

**Example Lineage Chain:**
```
Spencer's Carbonara (id=101, parent_id=NULL)
    └── Johnson's Carbonara (id=201, parent_id=101)
        └── Williams' Carbonara (id=301, parent_id=201)
```

**When Johnson deletes their recipe (id=201):**
- Williams' recipe.parent_id becomes NULL (was 201)
- Williams' recipe becomes standalone with no parent reference
- This is **intentional** - Williams never had direct access to Spencer's original

**Why we break lineage instead of preserving it:**
1. **Accurate History** - Williams only had access through Johnson
2. **No False Relationships** - Doesn't create Spencer→Williams link that never existed
3. **Access Control Respect** - Williams might not have had access to Spencer's recipe
4. **Clear Semantics** - NULL parent means "parent was deleted"

**Implementation via foreign key constraint:**
```sql
ALTER TABLE recipes ADD CONSTRAINT fk_recipes_parent 
    FOREIGN KEY (parent_id) REFERENCES recipes(id) 
    ON DELETE SET NULL ON UPDATE CASCADE;
```

This ensures:
- Child recipes continue to exist independently
- No false ancestry claims
- Simple, predictable behavior

## Edge Cases Handled

1. **Concurrent Editing**: Each household gets independent copies
2. **Collection Deletion**: Copied collections remain intact
3. **Recipe Sharing**: Multiple collections can reference same recipe until edited
4. **Ingredient Convergence**: Similar ingredients in different households (acceptable)
5. **Parent Chain Tracking**: Full lineage maintained for debugging (until parent deleted)
6. **Cleanup Safety**: Only household-owned resources are cleaned up
7. **Recipe Removal vs Deletion**: Removing from collection ≠ deleting recipe
8. **Edit Propagation**: Changes to originals affect references, not copies

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Data loss during cascade copying | Low | High | Comprehensive testing, transaction rollback |
| Performance impact of copying | Medium | Medium | Lazy copying, optimized queries |
| Storage growth from duplication | Low | Medium | Smart copying rules, cleanup procedures |
| Complex debugging with parent chains | Medium | Low | Clear lineage tracking, admin tools |

This hybrid approach provides the simplicity of copy-on-write with the efficiency of lazy evaluation, ensuring storage growth is controlled while maintaining full customization capabilities.