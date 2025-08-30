-- Migration: 008_add_oauth_support.sql
-- Add NextAuth OAuth support to existing database

-- Add OAuth fields to existing users table
ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(50) NULL COMMENT 'OAuth provider: google, facebook, etc.';
ALTER TABLE users ADD COLUMN oauth_provider_id VARCHAR(255) NULL COMMENT 'Provider-specific user ID';
ALTER TABLE users ADD COLUMN oauth_email VARCHAR(254) NULL COMMENT 'Email from OAuth provider';
ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0 COMMENT 'Email verification status';
ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL COMMENT 'Profile image from OAuth provider';

-- Make password optional for OAuth users
ALTER TABLE users MODIFY COLUMN password VARCHAR(128) NULL COMMENT 'Password hash (NULL for OAuth users)';

-- Add performance indexes
ALTER TABLE users ADD INDEX idx_oauth_provider (oauth_provider);
ALTER TABLE users ADD INDEX idx_oauth_provider_id (oauth_provider_id);
ALTER TABLE users ADD INDEX idx_oauth_email (oauth_email);
ALTER TABLE users ADD INDEX idx_email_verified (email_verified);

-- Add unique constraints
ALTER TABLE users ADD UNIQUE KEY unique_oauth_user (oauth_provider, oauth_provider_id);
-- Note: unique_email constraint may already exist, check first
-- ALTER TABLE users ADD UNIQUE KEY unique_email (email);

-- Create NextAuth accounts table for OAuth token management
CREATE TABLE nextauth_accounts (
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
CREATE TABLE nextauth_sessions (
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

-- Create household invitations table (for Phase 2)
CREATE TABLE household_invitations (
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

-- Mark existing users as email verified (they have passwords)
UPDATE users SET email_verified = 1 WHERE password IS NOT NULL;

-- Create event to clean up expired sessions
DELIMITER $$
CREATE EVENT cleanup_expired_sessions
    ON SCHEDULE EVERY 1 DAY
    DO
    BEGIN
        DELETE FROM nextauth_sessions WHERE expires < NOW();
    END$$
DELIMITER ;

-- Create event to clean up expired invitations
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

-- Insert migration record
INSERT INTO schema_migrations (version, executed_at, execution_time_ms) VALUES
('008_add_oauth_support.sql', NOW(), 0);