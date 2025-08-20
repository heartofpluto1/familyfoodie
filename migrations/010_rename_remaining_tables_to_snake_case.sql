-- Migration 010: Rename remaining tables to proper snake_case
-- This migration:
-- 1. Renames recipeingredients to recipe_ingredients
-- 2. Renames shoppinglists to shopping_lists

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Rename recipeingredients to recipe_ingredients
SET @rename_recipeingredients_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipeingredients') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipe_ingredients') = 0,
        'RENAME TABLE recipeingredients TO recipe_ingredients',
        'SELECT "recipeingredients rename not needed" as message'
    )
);
PREPARE rename_recipeingredients_stmt FROM @rename_recipeingredients_sql;
EXECUTE rename_recipeingredients_stmt;
DEALLOCATE PREPARE rename_recipeingredients_stmt;

-- 2. Rename shoppinglists to shopping_lists
SET @rename_shoppinglists_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'shoppinglists') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'shopping_lists') = 0,
        'RENAME TABLE shoppinglists TO shopping_lists',
        'SELECT "shoppinglists rename not needed" as message'
    )
);
PREPARE rename_shoppinglists_stmt FROM @rename_shoppinglists_sql;
EXECUTE rename_shoppinglists_stmt;
DEALLOCATE PREPARE rename_shoppinglists_stmt;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 010 completed: Renamed recipeingredients to recipe_ingredients and shoppinglists to shopping_lists' as status;