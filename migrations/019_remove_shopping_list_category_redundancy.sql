-- Migration: Remove redundant supermarketCategory_id from shopping_lists table
-- Issue: 007-remove-shopping-list-category-redundancy
-- Date: 2025-08-25
-- 
-- This migration removes the redundant supermarketCategory_id column from the shopping_lists table.
-- The category information will be obtained through joins to the ingredients table instead,
-- following the same pattern already used for pantryCategory.

-- Drop foreign key constraint first
ALTER TABLE shopping_lists 
DROP FOREIGN KEY menus_shoppinglist_supermarketCategory__4f049627_fk_menus_sup;

-- Drop the redundant column
ALTER TABLE shopping_lists 
DROP COLUMN supermarketCategory_id;

-- Note: Application code changes are required alongside this migration:
-- 1. Update queries in src/lib/queries/shop.ts to join through ingredients table
-- 2. Update queries in src/lib/queries/insights.ts to join through ingredients table  
-- 3. Remove supermarketCategory_id from INSERT statements in src/lib/queries/menus.ts
-- 4. Remove supermarketCategory_id from INSERT statements in src/app/api/shop/add/route.ts