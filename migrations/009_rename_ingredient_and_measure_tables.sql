-- Migration 009: Rename all remaining menus_ tables to clean naming
-- This migration renames all remaining Django-style table names:
-- menus_ingredient → ingredients
-- menus_measure → measurements
-- menus_pantrycategory → category_pantry
-- menus_preperation → preparations  
-- menus_primarytype → type_proteins
-- menus_recipeingredient → recipeingredients
-- menus_season → seasons
-- menus_secondarytype → type_carbs
-- menus_shoppinglist → shoppinglists
-- menus_supermarketcategory → category_supermarket

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Rename reference tables first (no dependencies)
-- Rename menus_season to seasons
SET @rename_season_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_season') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'seasons') = 0,
        'RENAME TABLE menus_season TO seasons',
        'SELECT "menus_season rename not needed" as message'
    )
);
PREPARE rename_season_stmt FROM @rename_season_sql;
EXECUTE rename_season_stmt;
DEALLOCATE PREPARE rename_season_stmt;

-- Rename menus_primarytype to type_proteins
SET @rename_primarytype_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_primarytype') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'type_proteins') = 0,
        'RENAME TABLE menus_primarytype TO type_proteins',
        'SELECT "menus_primarytype rename not needed" as message'
    )
);
PREPARE rename_primarytype_stmt FROM @rename_primarytype_sql;
EXECUTE rename_primarytype_stmt;
DEALLOCATE PREPARE rename_primarytype_stmt;

-- Rename menus_secondarytype to type_carbs
SET @rename_secondarytype_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_secondarytype') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'type_carbs') = 0,
        'RENAME TABLE menus_secondarytype TO type_carbs',
        'SELECT "menus_secondarytype rename not needed" as message'
    )
);
PREPARE rename_secondarytype_stmt FROM @rename_secondarytype_sql;
EXECUTE rename_secondarytype_stmt;
DEALLOCATE PREPARE rename_secondarytype_stmt;

-- Rename menus_pantrycategory to category_pantry
SET @rename_pantrycategory_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_pantrycategory') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'category_pantry') = 0,
        'RENAME TABLE menus_pantrycategory TO category_pantry',
        'SELECT "menus_pantrycategory rename not needed" as message'
    )
);
PREPARE rename_pantrycategory_stmt FROM @rename_pantrycategory_sql;
EXECUTE rename_pantrycategory_stmt;
DEALLOCATE PREPARE rename_pantrycategory_stmt;

-- Rename menus_supermarketcategory to category_supermarket
SET @rename_supermarketcategory_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_supermarketcategory') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'category_supermarket') = 0,
        'RENAME TABLE menus_supermarketcategory TO category_supermarket',
        'SELECT "menus_supermarketcategory rename not needed" as message'
    )
);
PREPARE rename_supermarketcategory_stmt FROM @rename_supermarketcategory_sql;
EXECUTE rename_supermarketcategory_stmt;
DEALLOCATE PREPARE rename_supermarketcategory_stmt;

-- Rename menus_preperation to preparations (correcting the spelling)
SET @rename_preperation_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_preperation') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'preparations') = 0,
        'RENAME TABLE menus_preperation TO preparations',
        'SELECT "menus_preperation rename not needed" as message'
    )
);
PREPARE rename_preperation_stmt FROM @rename_preperation_sql;
EXECUTE rename_preperation_stmt;
DEALLOCATE PREPARE rename_preperation_stmt;

-- 2. Rename menus_measure to measurements (referenced by ingredients)
SET @rename_measure_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_measure') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'measurements') = 0,
        'RENAME TABLE menus_measure TO measurements',
        'SELECT "menus_measure rename not needed" as message'
    )
);
PREPARE rename_measure_stmt FROM @rename_measure_sql;
EXECUTE rename_measure_stmt;
DEALLOCATE PREPARE rename_measure_stmt;

-- 3. Rename menus_ingredient to ingredients (references pantrycategories, supermarketcategories)
SET @rename_ingredient_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_ingredient') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ingredients') = 0,
        'RENAME TABLE menus_ingredient TO ingredients',
        'SELECT "menus_ingredient rename not needed" as message'
    )
);
PREPARE rename_ingredient_stmt FROM @rename_ingredient_sql;
EXECUTE rename_ingredient_stmt;
DEALLOCATE PREPARE rename_ingredient_stmt;

-- 4. Rename menus_recipeingredient to recipeingredients (references ingredients, measurements, preparations)
SET @rename_recipeingredient_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_recipeingredient') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'recipeingredients') = 0,
        'RENAME TABLE menus_recipeingredient TO recipeingredients',
        'SELECT "menus_recipeingredient rename not needed" as message'
    )
);
PREPARE rename_recipeingredient_stmt FROM @rename_recipeingredient_sql;
EXECUTE rename_recipeingredient_stmt;
DEALLOCATE PREPARE rename_recipeingredient_stmt;

-- 5. Rename menus_shoppinglist to shoppinglists (references recipeingredients, supermarketcategories)
SET @rename_shoppinglist_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'menus_shoppinglist') > 0 
        AND 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'shoppinglists') = 0,
        'RENAME TABLE menus_shoppinglist TO shoppinglists',
        'SELECT "menus_shoppinglist rename not needed" as message'
    )
);
PREPARE rename_shoppinglist_stmt FROM @rename_shoppinglist_sql;
EXECUTE rename_shoppinglist_stmt;
DEALLOCATE PREPARE rename_shoppinglist_stmt;

-- 6. Update data - fix 'CouscousQuinoaBarley' value in type_carbs table
SET @update_carb_data_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'type_carbs') > 0
        AND
        (SELECT COUNT(*) FROM type_carbs WHERE name = 'CouscousQuinoaBarley') > 0,
        'UPDATE type_carbs SET name = ''Couscous, Quinoa, Barley'' WHERE name = ''CouscousQuinoaBarley''',
        'SELECT "CouscousQuinoaBarley data update not needed" as message'
    )
);
PREPARE update_carb_data_stmt FROM @update_carb_data_sql;
EXECUTE update_carb_data_stmt;
DEALLOCATE PREPARE update_carb_data_stmt;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 009 completed: Renamed all menus_ tables to clean naming convention and updated data' as status;