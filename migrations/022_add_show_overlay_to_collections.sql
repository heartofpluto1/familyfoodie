-- Migration: 022_add_show_overlay_to_collections.sql
-- Description: Add show_overlay boolean field to collections table to control texture overlay display
-- Date: 2025-08-31

-- Add show_overlay column to collections table
-- Default to true (1) to maintain existing behavior for all collections
ALTER TABLE collections 
ADD COLUMN show_overlay TINYINT(1) NOT NULL DEFAULT 1 
COMMENT 'Controls whether texture overlay displays on collection cards'
AFTER filename_dark;

-- Add index for performance when filtering by show_overlay
ALTER TABLE collections ADD INDEX idx_show_overlay (show_overlay);