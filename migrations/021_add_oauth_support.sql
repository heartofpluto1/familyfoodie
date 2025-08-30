-- Migration: 021_add_oauth_support.sql
-- Convert to pure OAuth authentication (idempotent)
-- Date: 2025-08-30
-- Description: Remove password authentication and convert to OAuth-only with NextAuth.js support

-- Disable foreign key checks during migration
SET FOREIGN_KEY_CHECKS = 0;

-- Drop legacy authentication columns
ALTER TABLE users DROP COLUMN IF EXISTS username;
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Add OAuth-specific fields (only if they don't exist)
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50) NOT NULL DEFAULT 'google' COMMENT 'OAuth provider: google, facebook, etc.';
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider_id VARCHAR(255) NOT NULL DEFAULT '0' COMMENT 'Provider-specific user ID';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) DEFAULT 1 COMMENT 'Email verification status';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500) NULL COMMENT 'Profile image from OAuth provider';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp';

-- Ensure required fields exist (may already be present from Django)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin TINYINT(1) DEFAULT 0 COMMENT 'Admin status';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1 COMMENT 'Account active status';
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_joined DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Account creation date';

-- Migrate existing users to have placeholder OAuth values
-- Use their user ID as the oauth_provider_id (1, 2 for the two existing users)
UPDATE users 
SET oauth_provider = 'google',
    oauth_provider_id = CAST(id AS CHAR),
    email_verified = 1
WHERE oauth_provider = 'google' AND oauth_provider_id = '0';

-- Remove the defaults after migration
ALTER TABLE users ALTER COLUMN oauth_provider DROP DEFAULT;
ALTER TABLE users ALTER COLUMN oauth_provider_id DROP DEFAULT;

-- Add performance indexes (only if they don't exist)
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_oauth_provider (oauth_provider);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_oauth_provider_id (oauth_provider_id);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_email_verified (email_verified);

-- Add unique constraints (only if they don't exist)
ALTER TABLE users ADD UNIQUE KEY IF NOT EXISTS unique_oauth_user (oauth_provider, oauth_provider_id);
-- Email uniqueness - only add if doesn't exist
ALTER TABLE users ADD UNIQUE KEY IF NOT EXISTS unique_email (email);

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