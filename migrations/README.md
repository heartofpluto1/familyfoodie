# Database Migrations

This directory contains database migrations for the FamilyFoodie application.

## Structure

- Migration files are named with a numeric prefix to ensure execution order (e.g., `001_create_schema_migrations.sql`)
- Each migration is a SQL file that can contain multiple statements
- The `run-migrations.js` script handles executing migrations and tracking which have been run

## Running Migrations

### Locally
```bash
# Run all pending migrations
npm run migrate

# Run migrations with production environment
npm run migrate:prod
```

### Via API (for automated deployments)
```bash
# Requires authentication and migration token in production
curl -X POST http://localhost:3000/api/admin/migrate \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "x-migration-token: YOUR_MIGRATION_TOKEN"
```

**Token Format Requirements (Production):**
- Minimum 10 characters
- Only alphanumeric characters and hyphens allowed (`a-z`, `A-Z`, `0-9`, `-`)
- Examples: `migration-2024`, `prod-token-abc123`, `secure-key-xyz789`

## Creating New Migrations

1. Create a new SQL file with the next number in sequence:
   ```
   003_your_migration_name.sql
   ```

2. Add your SQL statements:
   ```sql
   -- Migration: Brief description
   -- Date: YYYY-MM-DD
   -- Description: Detailed description of what this migration does
   
   CREATE TABLE example (
     id INT PRIMARY KEY AUTO_INCREMENT,
     ...
   );
   ```

3. Test locally first:
   ```bash
   npm run migrate
   ```

## Migration Tracking

Migrations are tracked in the `schema_migrations` table:
- `version`: The filename of the migration
- `executed_at`: When the migration was run
- `execution_time_ms`: How long the migration took

## Best Practices

1. **Always test migrations locally first** with a database dump
2. **Keep migrations small and focused** - one logical change per migration
3. **Never modify existing migrations** - create new ones to make changes
4. **Include rollback instructions** in comments if the migration is complex
5. **Use transactions** where possible (the runner handles this automatically)

## Rollback Strategy

Currently, rollbacks must be handled manually by creating a new migration that reverses the changes. Consider keeping rollback SQL in comments within each migration for reference.

## Production Deployment

Migrations are run automatically during deployment via the CI/CD pipeline. The deployment script:
1. Deploys the new application code
2. Calls the migration API endpoint to run any pending migrations
3. Verifies migration success before completing deployment