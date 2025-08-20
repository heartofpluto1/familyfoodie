-- Migration: Create schema migrations tracking table
-- Date: 2024-08-20
-- Description: Create table to track which migrations have been executed

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INT DEFAULT NULL,
  INDEX idx_executed_at (executed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: The migration runner will automatically record this migration after successful execution