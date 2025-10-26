-- Migration: Drop quantity4 column from shopping_lists table
-- Description: Removes unused quantity4 column now that shopping list generation
--              stores the correct quantity based on plan.shop_qty directly in quantity column
-- Author: Claude Code
-- Date: 2025-10-26

-- ============================================================================
-- IDEMPOTENT: This migration can be run multiple times safely
-- ============================================================================

-- Drop quantity4 column from shopping_lists table (if it exists)
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shopping_lists'
    AND COLUMN_NAME = 'quantity4'
);

SET @sql = IF(
    @col_exists = 1,
    'ALTER TABLE shopping_lists DROP COLUMN quantity4',
    'SELECT ''Column shopping_lists.quantity4 does not exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verification queries
SELECT 'Migration completed successfully' AS status;

-- Verify column is dropped
SELECT
    'shopping_lists columns' AS info,
    COLUMN_NAME,
    COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'shopping_lists'
ORDER BY ORDINAL_POSITION;
