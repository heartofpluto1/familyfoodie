-- Migration: Test database error handling functionality
-- Date: 2025-08-23
-- Description: Simple test migration to verify that the migration system works correctly 
-- with the new database Proxy wrapper for error handling

-- Create a temporary test table
CREATE TABLE test_migration_table (
    id INT PRIMARY KEY AUTO_INCREMENT,
    test_column VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert a test record
INSERT INTO test_migration_table (test_column) VALUES ('Database error handling test');

-- Drop the test table immediately (this migration is just for testing)
DROP TABLE test_migration_table;