-- Migration 018: Set default value for collections url_slug field
-- This migration:
-- 1. Sets default value '1-initial' for url_slug to satisfy NOT NULL constraint
-- 2. The application code will update this with proper slug after collection creation

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Modify url_slug to have default value (informative placeholder)
ALTER TABLE collections 
MODIFY COLUMN url_slug VARCHAR(255) NOT NULL DEFAULT '1-initial';

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 018 completed: Set default value for collections url_slug field' as status;