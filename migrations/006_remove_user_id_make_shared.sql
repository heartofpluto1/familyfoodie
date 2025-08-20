-- Migration: Remove user_id columns to make system shared
-- This removes all user/account segregation - all authenticated users see the same data

-- Remove user_id from menus_recipeweek
ALTER TABLE menus_recipeweek 
DROP FOREIGN KEY menus_recipeweek_user_id_fk;

ALTER TABLE menus_recipeweek 
DROP COLUMN user_id;

-- Remove user_id from menus_shoppinglist  
ALTER TABLE menus_shoppinglist 
DROP FOREIGN KEY menus_shoppinglist_user_id_fk;

ALTER TABLE menus_shoppinglist 
DROP COLUMN user_id;

-- Migration complete: System is now fully shared with no user/account segregation