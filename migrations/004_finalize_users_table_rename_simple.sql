-- Migration: Finalize users table rename (simplified for account removal)
-- This migration completes the transition from auth_user to users table
-- Since we're removing the account system in migration 005, this is simplified

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Drop Django auth tables that reference auth_user
DROP TABLE IF EXISTS auth_user_groups;
DROP TABLE IF EXISTS auth_user_user_permissions;
DROP TABLE IF EXISTS auth_group;
DROP TABLE IF EXISTS auth_group_permissions;
DROP TABLE IF EXISTS auth_permission;
DROP TABLE IF EXISTS django_content_type;
DROP TABLE IF EXISTS django_session;
DROP TABLE IF EXISTS django_admin_log;

-- Drop the auth_user table (users table already exists with data)
DROP TABLE IF EXISTS auth_user;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Migration complete: auth_user table and Django tables removed
-- Note: menus_accountuser table cleanup will be handled in migration 005