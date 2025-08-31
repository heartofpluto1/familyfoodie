-- Migration: 024_make_oauth_fields_nullable.sql
-- Date: 2025-08-31
-- Description: Make oauth_provider and oauth_provider_id nullable to support NextAuth adapter flow
-- NextAuth calls createUser before linkAccount, so we need these fields to be nullable temporarily

-- Make oauth_provider nullable
ALTER TABLE users 
MODIFY COLUMN oauth_provider VARCHAR(50) NULL DEFAULT NULL 
COMMENT 'OAuth provider: google, facebook, etc. - NULL until linkAccount is called';

-- Make oauth_provider_id nullable  
ALTER TABLE users 
MODIFY COLUMN oauth_provider_id VARCHAR(255) NULL DEFAULT NULL 
COMMENT 'Provider-specific user ID - NULL until linkAccount is called';