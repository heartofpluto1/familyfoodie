-- Migration 008: Remove Django migrations table
-- This migration removes the django_migrations table since we're now using our own migration system

-- Check if django_migrations table exists and drop it
SET @drop_django_migrations_sql = (
    SELECT IF(
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'django_migrations') > 0,
        'DROP TABLE django_migrations',
        'SELECT "django_migrations table does not exist" as message'
    )
);
PREPARE drop_django_migrations_stmt FROM @drop_django_migrations_sql;
EXECUTE drop_django_migrations_stmt;
DEALLOCATE PREPARE drop_django_migrations_stmt;

SELECT 'Migration 008 completed: Removed django_migrations table' as status;