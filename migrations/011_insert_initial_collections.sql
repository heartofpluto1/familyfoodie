-- Migration 011: Insert initial collections
-- This migration adds 3 starter collections to the collections table

-- Insert 3 initial collections
INSERT INTO collections (title, subtitle, filename) VALUES
(
    'Dinner at the Spencer house',
    'Our go-to meals, any night of the week',
    'custom_collection_001'
),
(
    'Tasty treats at the Spencer house', 
    'What we bake, again and again',
    'custom_collection_002'
),
(
    "Sarah's healthy snacks",
    "The kids don't like these 😉",
    'custom_collection_003'
);

SELECT 'Migration 011 completed: Added 3 initial collections' as status;