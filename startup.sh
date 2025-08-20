#!/bin/sh

echo "Starting FamilyFoodie application..."

# Check if server.js exists
if [ ! -f "server.js" ]; then
  echo "ERROR: server.js not found!"
  ls -la
  exit 1
fi

# Check environment variables
echo "Checking database environment variables..."
if [ -z "$DB_HOST" ]; then
  echo "WARNING: DB_HOST not set"
fi
if [ -z "$DB_PORT" ]; then
  echo "WARNING: DB_PORT not set"  
fi
if [ -z "$DB_NAME" ]; then
  echo "WARNING: DB_NAME not set"
fi

# Run database migrations
echo "Running database migrations..."
node migrations/run-migrations.mjs

if [ $? -ne 0 ]; then
  echo "Migration failed! Exiting..."
  exit 1
fi

echo "Migrations completed successfully"

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js