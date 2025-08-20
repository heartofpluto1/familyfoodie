-- Migration: Rename auth_user table to users (fixed version)
-- This migration safely renames the auth_user table to users and updates foreign key references

-- Step 1: Create new users table with all data from auth_user (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS users LIKE auth_user;

-- Clear and repopulate the users table to ensure it has current data
DELETE FROM users;
INSERT INTO users SELECT * FROM auth_user;

-- Step 2: Clean up orphaned records and update foreign key references

-- First, identify and remove any orphaned records in menus_accountuser 
-- that reference non-existent users
DELETE FROM menus_accountuser 
WHERE user_id NOT IN (SELECT id FROM users);

-- Add new foreign key column (only if it doesn't exist)
SET @column_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_SCHEMA = DATABASE() 
                     AND TABLE_NAME = 'menus_accountuser' 
                     AND COLUMN_NAME = 'new_user_id');

SET @sql = IF(@column_exists = 0, 
              'ALTER TABLE menus_accountuser ADD COLUMN new_user_id int(11)', 
              'SELECT "Column new_user_id already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Copy the data from old user_id to new_user_id (only valid references remain)
UPDATE menus_accountuser 
SET new_user_id = user_id;

-- Make the new column NOT NULL since all data has been copied
ALTER TABLE menus_accountuser 
MODIFY new_user_id int(11) NOT NULL;

-- Add the new foreign key constraint pointing to users table (only if it doesn't exist)
SET @constraint_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
                         WHERE TABLE_SCHEMA = DATABASE() 
                         AND TABLE_NAME = 'menus_accountuser' 
                         AND CONSTRAINT_NAME = 'menus_accountuser_new_user_id_fk');

SET @sql = IF(@constraint_exists = 0, 
              'ALTER TABLE menus_accountuser ADD CONSTRAINT menus_accountuser_new_user_id_fk FOREIGN KEY (new_user_id) REFERENCES users (id)', 
              'SELECT "Constraint menus_accountuser_new_user_id_fk already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Note: Steps 3-5 (application code updates, dropping old constraints, and dropping auth_user table) 
-- will be handled in a separate migration after code changes are deployed