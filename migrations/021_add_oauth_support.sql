-- Migration: 021_add_oauth_support.sql
-- Convert to pure OAuth authentication (idempotent)
-- Date: 2025-08-30
-- Description: Remove password authentication and convert to OAuth-only with NextAuth.js support

-- Disable foreign key checks during migration
SET FOREIGN_KEY_CHECKS = 0;

-- Drop legacy authentication columns (check existence first)
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'username'
);
SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE users DROP COLUMN username', 
    'SELECT "Column username does not exist" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'password'
);
SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE users DROP COLUMN password', 
    'SELECT "Column password does not exist" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop last_login column (redundant with NextAuth sessions tracking)
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'last_login'
);
SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE users DROP COLUMN last_login', 
    'SELECT "Column last_login does not exist" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add OAuth-specific fields (only if they don't exist)
SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'oauth_provider');
SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(50) NOT NULL DEFAULT ''google'' COMMENT ''OAuth provider: google, facebook, etc.''',
    'SELECT "Column oauth_provider already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'oauth_provider_id');
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE users ADD COLUMN oauth_provider_id VARCHAR(255) NOT NULL DEFAULT ''0'' COMMENT ''Provider-specific user ID''',
    'SELECT "Column oauth_provider_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified');
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 1 COMMENT ''Email verification status''',
    'SELECT "Column email_verified already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profile_image_url');
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL COMMENT ''Profile image from OAuth provider''',
    'SELECT "Column profile_image_url already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'updated_at');
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT ''Last update timestamp''',
    'SELECT "Column updated_at already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure required fields exist (may already be present from Django)
SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin');
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE users ADD COLUMN is_admin TINYINT(1) DEFAULT 0 COMMENT ''Admin status''',
    'SELECT "Column is_admin already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active');
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1 COMMENT ''Account active status''',
    'SELECT "Column is_active already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'date_joined');
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE users ADD COLUMN date_joined DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT ''Account creation date''',
    'SELECT "Column date_joined already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate existing users to have placeholder OAuth values
-- Set oauth_provider_id to 'pending' for users who haven't linked OAuth yet
UPDATE users 
SET oauth_provider = 'google',
    oauth_provider_id = 'pending',
    email_verified = 1
WHERE oauth_provider = 'google' AND oauth_provider_id = '0';

-- Remove the defaults after migration
ALTER TABLE users ALTER COLUMN oauth_provider DROP DEFAULT;
ALTER TABLE users ALTER COLUMN oauth_provider_id DROP DEFAULT;

-- Add performance indexes (only if they don't exist)
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_oauth_provider');
SET @sql = IF(@index_exists = 0,
    'ALTER TABLE users ADD INDEX idx_oauth_provider (oauth_provider)',
    'SELECT "Index idx_oauth_provider already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_oauth_provider_id');
SET @sql = IF(@index_exists = 0,
    'ALTER TABLE users ADD INDEX idx_oauth_provider_id (oauth_provider_id)',
    'SELECT "Index idx_oauth_provider_id already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_email_verified');
SET @sql = IF(@index_exists = 0,
    'ALTER TABLE users ADD INDEX idx_email_verified (email_verified)',
    'SELECT "Index idx_email_verified already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Clean up duplicate 'pending' entries before adding constraint
-- Update 'pending' oauth_provider_id values to NULL (NULLs don't violate unique constraints)
UPDATE users 
SET oauth_provider_id = NULL 
WHERE oauth_provider_id = 'pending';

-- Also update oauth_provider to NULL for consistency when oauth_provider_id is NULL
UPDATE users 
SET oauth_provider = NULL 
WHERE oauth_provider_id IS NULL AND oauth_provider = 'pending';

-- Add unique constraints (only if they don't exist)
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'unique_oauth_user');
SET @sql = IF(@constraint_exists = 0,
    'ALTER TABLE users ADD UNIQUE KEY unique_oauth_user (oauth_provider, oauth_provider_id)',
    'SELECT "Constraint unique_oauth_user already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Email uniqueness - only add if doesn't exist
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'unique_email');
SET @sql = IF(@constraint_exists = 0,
    'ALTER TABLE users ADD UNIQUE KEY unique_email (email)',
    'SELECT "Constraint unique_email already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create NextAuth accounts table for OAuth token management
CREATE TABLE IF NOT EXISTS nextauth_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INT,
    token_type VARCHAR(255),
    scope VARCHAR(255),
    id_token TEXT,
    session_state VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_provider_account (provider, provider_account_id),
    INDEX idx_user_id (user_id),
    INDEX idx_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create NextAuth sessions table
CREATE TABLE IF NOT EXISTS nextauth_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    expires TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires (expires),
    INDEX idx_session_token (session_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create household invitations table
CREATE TABLE IF NOT EXISTS household_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    household_id INT NOT NULL,
    invited_by_user_id INT NOT NULL,
    invite_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP NULL,
    declined_at TIMESTAMP NULL,
    
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_email (email),
    INDEX idx_household (household_id),
    INDEX idx_token (invite_token),
    INDEX idx_expires (expires_at),
    INDEX idx_invited_by (invited_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- No need to mark existing users as verified since we're removing password auth entirely

-- Create event to clean up expired sessions (drop if exists first)
DROP EVENT IF EXISTS cleanup_expired_sessions;
DELIMITER $$
CREATE EVENT cleanup_expired_sessions
    ON SCHEDULE EVERY 1 DAY
    DO
    BEGIN
        DELETE FROM nextauth_sessions WHERE expires < NOW();
    END$$
DELIMITER ;

-- Create event to clean up expired invitations (drop if exists first)
DROP EVENT IF EXISTS cleanup_expired_invitations;
DELIMITER $$
CREATE EVENT cleanup_expired_invitations
    ON SCHEDULE EVERY 1 DAY
    DO
    BEGIN
        DELETE FROM household_invitations 
        WHERE expires_at < NOW() 
        AND accepted_at IS NULL 
        AND declined_at IS NULL;
    END$$
DELIMITER ;

-- Enable event scheduler if not already enabled
SET GLOBAL event_scheduler = ON;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Report completion
SELECT 'Migration 021 completed: Converted to OAuth authentication, removed password fields, added NextAuth tables' as status;