-- Migration 012: Assign all existing recipes to the first collection
-- This migration sets all recipes to belong to "Dinner at the Spencer House" collection

-- Update all recipes to belong to the first collection
-- Using a subquery to get the first collection's ID dynamically
UPDATE recipes 
SET collection_id = (
    SELECT id 
    FROM collections 
    ORDER BY id ASC 
    LIMIT 1
)
WHERE collection_id IS NULL;

SELECT CONCAT('Migration 012 completed: Assigned ', ROW_COUNT(), ' recipes to the first collection') as status;