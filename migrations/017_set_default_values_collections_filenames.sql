-- Migration 017: Set default values for collections filename fields
-- This migration:
-- 1. Sets default value 'custom_collection_004' for filename
-- 2. Sets default value 'custom_collection_004_dark' for filename_dark

-- Disable foreign key checks during table operations
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Modify filename to have default value 'custom_collection_004'
ALTER TABLE collections 
MODIFY COLUMN filename VARCHAR(255) DEFAULT 'custom_collection_004';

-- 2. Modify filename_dark to have default value 'custom_collection_004_dark'
ALTER TABLE collections 
MODIFY COLUMN filename_dark VARCHAR(255) DEFAULT 'custom_collection_004_dark';

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Migration 017 completed: Set default values for collections filename fields' as status;