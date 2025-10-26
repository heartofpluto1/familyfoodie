-- Migration: Add shop_qty fields to recipes and plans tables
-- Description: Introduces customizable shopping quantities (2p or 4p) for recipes
--              with plan-level overrides to support batch cooking and entertaining
-- Author: Claude Code
-- Date: 2025-10-26

-- ============================================================================
-- IDEMPOTENT: This migration can be run multiple times safely
-- ============================================================================

-- Add shop_qty to recipes table (if not exists)
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'recipes'
    AND COLUMN_NAME = 'shop_qty'
);

SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE recipes ADD COLUMN shop_qty SMALLINT NOT NULL DEFAULT 2 COMMENT ''2 or 4 people - default shopping quantity for this recipe''',
    'SELECT ''Column recipes.shop_qty already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add shop_qty to plans table (if not exists)
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'plans'
    AND COLUMN_NAME = 'shop_qty'
);

SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE plans ADD COLUMN shop_qty SMALLINT NOT NULL DEFAULT 2 COMMENT ''2 or 4 people - shopping quantity for this specific plan entry''',
    'SELECT ''Column plans.shop_qty already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on recipes.shop_qty (if not exists)
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'recipes'
    AND INDEX_NAME = 'idx_recipes_shop_qty'
);

SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_recipes_shop_qty ON recipes(shop_qty)',
    'SELECT ''Index idx_recipes_shop_qty already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on plans.shop_qty (if not exists)
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'plans'
    AND INDEX_NAME = 'idx_plans_shop_qty'
);

SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_plans_shop_qty ON plans(shop_qty)',
    'SELECT ''Index idx_plans_shop_qty already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add check constraint on recipes.shop_qty (if not exists)
-- Note: MySQL 8.0.16+ supports check constraints
SET @constraint_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'recipes'
    AND CONSTRAINT_NAME = 'chk_recipes_shop_qty'
);

SET @sql = IF(
    @constraint_exists = 0,
    'ALTER TABLE recipes ADD CONSTRAINT chk_recipes_shop_qty CHECK (shop_qty IN (2, 4))',
    'SELECT ''Constraint chk_recipes_shop_qty already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add check constraint on plans.shop_qty (if not exists)
SET @constraint_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'plans'
    AND CONSTRAINT_NAME = 'chk_plans_shop_qty'
);

SET @sql = IF(
    @constraint_exists = 0,
    'ALTER TABLE plans ADD CONSTRAINT chk_plans_shop_qty CHECK (shop_qty IN (2, 4))',
    'SELECT ''Constraint chk_plans_shop_qty already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verification queries
SELECT 'Migration completed successfully' AS status;

SELECT
    'recipes' AS table_name,
    COLUMN_NAME,
    COLUMN_TYPE,
    COLUMN_DEFAULT,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'recipes'
AND COLUMN_NAME = 'shop_qty';

SELECT
    'plans' AS table_name,
    COLUMN_NAME,
    COLUMN_TYPE,
    COLUMN_DEFAULT,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'plans'
AND COLUMN_NAME = 'shop_qty';

-- Show indexes
SELECT
    'recipes indexes' AS info,
    INDEX_NAME,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'recipes'
AND INDEX_NAME LIKE '%shop_qty%';

SELECT
    'plans indexes' AS info,
    INDEX_NAME,
    COLUMN_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'plans'
AND INDEX_NAME LIKE '%shop_qty%';

-- Show constraints
SELECT
    'recipes constraints' AS info,
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'recipes'
AND CONSTRAINT_NAME LIKE '%shop_qty%';

SELECT
    'plans constraints' AS info,
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'plans'
AND CONSTRAINT_NAME LIKE '%shop_qty%';
