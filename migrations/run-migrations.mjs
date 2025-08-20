import pool from '../src/lib/db.js';
import fs from 'fs/promises';
import path from 'path';

async function runMigrations() {
	console.log('Starting database migrations...');

	// Check database connection first
	try {
		await pool.execute('SELECT 1');
		console.log('✓ Database connection successful');
	} catch (error) {
		console.error('✗ Database connection failed:', error.message);
		console.error('Please check your database configuration');
		throw error;
	}

	try {
		// Get list of migration files
		// Use process.cwd() to get the correct project root path
		const migrationDir = path.join(process.cwd(), 'migrations');
		const files = await fs.readdir(migrationDir);
		const sqlFiles = files.filter(f => f.endsWith('.sql')).sort(); // Sort alphabetically to run in order

		console.log(`Found ${sqlFiles.length} migration files`);

		// Check if schema_migrations table exists (for first run)
		const [tables] = await pool.execute("SHOW TABLES LIKE 'schema_migrations'");

		let executedVersions = new Set();

		if (tables.length > 0) {
			// Get already executed migrations
			const [executed] = await pool.execute('SELECT version FROM schema_migrations ORDER BY executed_at');
			executedVersions = new Set(executed.map(row => row.version));
			console.log(`Already executed: ${executed.length} migrations`);
		} else {
			console.log('First run - schema_migrations table will be created');
		}

		// Run pending migrations
		let migrationsRun = 0;
		for (const file of sqlFiles) {
			if (!executedVersions.has(file)) {
				console.log(`\nRunning migration: ${file}`);
				const startTime = Date.now();

				// Read the migration file
				const sqlPath = path.join(migrationDir, file);
				const sql = await fs.readFile(sqlPath, 'utf8');

				// Execute migration in a transaction
				const connection = await pool.getConnection();
				try {
					await connection.beginTransaction();

					// Split SQL by semicolons and execute each statement
					// Filter out empty statements and comments
					const statements = sql
						.split(';')
						.map(s => {
							// Remove comments from the statement and clean it up
							const lines = s
								.split('\n')
								.map(line => line.trim())
								.filter(line => !line.startsWith('--') && line.length > 0);
							return lines.join('\n').trim();
						})
						.filter(s => s.length > 0);

					for (const statement of statements) {
						if (statement.trim()) {
							await connection.query(statement);
						}
					}

					// Record the migration (except for the schema_migrations creation itself)
					if (file !== '001_create_schema_migrations.sql') {
						const executionTime = Date.now() - startTime;
						await connection.execute('INSERT INTO schema_migrations (version, execution_time_ms) VALUES (?, ?)', [file, executionTime]);
					}

					await connection.commit();
					const executionTime = Date.now() - startTime;
					console.log(`✓ Migration ${file} completed in ${executionTime}ms`);

					// Special case: record the schema_migrations creation after commit
					if (file === '001_create_schema_migrations.sql') {
						// Verify table was created and record the migration
						const [checkTables] = await pool.execute("SHOW TABLES LIKE 'schema_migrations'");
						if (checkTables.length > 0) {
							await pool.execute('INSERT INTO schema_migrations (version, execution_time_ms) VALUES (?, ?)', [file, executionTime]);
						} else {
							throw new Error('schema_migrations table was not created despite successful migration');
						}
					}
					migrationsRun++;
				} catch (error) {
					await connection.rollback();
					console.error(`✗ Migration ${file} failed:`, error.message);
					throw error;
				} finally {
					connection.release();
				}
			}
		}

		if (migrationsRun === 0) {
			console.log('\n✓ All migrations are up to date');
		} else {
			console.log(`\n✓ Successfully ran ${migrationsRun} migration(s)`);
		}

		return { success: true, migrationsRun };
	} catch (error) {
		console.error('\n✗ Migration failed:', error);
		throw error;
	}
}

// Run if called directly from command line
if (import.meta.url === `file://${process.argv[1]}`) {
	runMigrations()
		.then(() => {
			console.log('\nMigration process completed successfully');
			process.exit(0);
		})
		.catch(err => {
			console.error(err instanceof Error ? err.message : '\nMigration process failed');
			process.exit(1);
		});
}

export default runMigrations;
