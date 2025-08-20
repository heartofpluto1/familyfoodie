-- Migration: Simplify user permissions - remove is_staff, rename is_superuser to is_admin
-- Date: 2025-08-20
-- Description: Consolidate user permissions to a single is_admin flag

-- Step 1: Add new is_admin column
ALTER TABLE auth_user 
ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER email;

-- Step 2: Copy data from is_superuser to is_admin
-- Also set is_admin=1 for any user who was staff (consolidating permissions)
UPDATE auth_user 
SET is_admin = CASE 
    WHEN is_superuser = 1 THEN 1
    WHEN is_staff = 1 THEN 1
    ELSE 0
END;

-- Step 3: Drop the old columns
ALTER TABLE auth_user 
DROP COLUMN is_staff,
DROP COLUMN is_superuser;

-- Step 4: Add index on is_admin for performance
CREATE INDEX idx_auth_user_is_admin ON auth_user(is_admin);