-- Migration: Remove multi-tenant account system
-- This migration removes all account-related tables and foreign keys to prepare for a new multi-tenant approach

-- Disable foreign key checks to handle dependencies
SET FOREIGN_KEY_CHECKS = 0;

-- Step 1: Drop all tables that depend on menus_account
-- These tables will be recreated later with a new multi-tenant design

DROP TABLE IF EXISTS menus_accountingredient;
DROP TABLE IF EXISTS menus_accountrecipe; 
DROP TABLE IF EXISTS menus_accountuser;

-- Step 2: Remove account_id columns from remaining tables (if they exist)
-- Check if menus_recipeweek has account_id column
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'menus_recipeweek' 
    AND COLUMN_NAME = 'account_id'
);

-- Check if user_id column already exists
SET @user_id_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'menus_recipeweek' 
    AND COLUMN_NAME = 'user_id'
);

-- Only add user_id column if it doesn't exist
SET @sql = IF(@user_id_exists = 0, 
    'ALTER TABLE menus_recipeweek ADD COLUMN user_id int(11) AFTER recipe_id', 
    'SELECT "user_id column already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Set user_id to 1 for all existing records (temporary single-user setup)
UPDATE menus_recipeweek 
SET user_id = 1 
WHERE user_id IS NULL;

-- Drop account_id column and constraints if they exist
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'menus_recipeweek' 
    AND COLUMN_NAME = 'account_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);

SET @sql = IF(@fk_exists > 0, 
    'ALTER TABLE menus_recipeweek DROP FOREIGN KEY menus_recipeweek_account_id_1bf52443_fk_menus_account_id', 
    'SELECT "No FK constraint to drop" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE menus_recipeweek DROP COLUMN account_id', 
    'SELECT "No account_id column to drop" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for user_id pointing to users table
ALTER TABLE menus_recipeweek 
ADD CONSTRAINT menus_recipeweek_user_id_fk 
FOREIGN KEY (user_id) REFERENCES users (id);

-- Step 3: menus_shoppinglist - remove account_id, make it user-based instead
SET @sl_column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'menus_shoppinglist' 
    AND COLUMN_NAME = 'account_id'
);

-- Check if user_id column already exists in menus_shoppinglist
SET @sl_user_id_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'menus_shoppinglist' 
    AND COLUMN_NAME = 'user_id'
);

-- Only add user_id column if it doesn't exist
SET @sql = IF(@sl_user_id_exists = 0, 
    'ALTER TABLE menus_shoppinglist ADD COLUMN user_id int(11)', 
    'SELECT "user_id column already exists in menus_shoppinglist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Set user_id to 1 for all existing records (temporary single-user setup)
UPDATE menus_shoppinglist 
SET user_id = 1 
WHERE user_id IS NULL;

-- Drop account_id column and constraints if they exist
SET @sl_fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'menus_shoppinglist' 
    AND COLUMN_NAME = 'account_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
);

SET @sql = IF(@sl_fk_exists > 0, 
    'ALTER TABLE menus_shoppinglist DROP FOREIGN KEY menus_shoppinglist_account_id_dac27379_fk_menus_account_id', 
    'SELECT "No FK constraint to drop" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@sl_column_exists > 0, 
    'ALTER TABLE menus_shoppinglist DROP COLUMN account_id', 
    'SELECT "No account_id column to drop" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key for user_id pointing to users table
ALTER TABLE menus_shoppinglist 
ADD CONSTRAINT menus_shoppinglist_user_id_fk 
FOREIGN KEY (user_id) REFERENCES users (id);

-- Step 4: Drop the main menus_account table (no longer needed)
DROP TABLE IF EXISTS menus_account;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Migration complete: Multi-tenant account system has been removed
-- All data is now user-based instead of account-based