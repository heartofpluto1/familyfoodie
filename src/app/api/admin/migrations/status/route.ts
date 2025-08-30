import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth/helpers';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';
import fs from 'fs/promises';
import path from 'path';

interface MigrationRecord extends RowDataPacket {
	version: string;
	executed_at: Date;
	execution_time_ms: number | null;
}

export async function GET(): Promise<NextResponse> {
	const auth = await requireAdminAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		// Get all migration files from the migrations directory
		const migrationsPath = path.join(process.cwd(), 'migrations');
		const files = await fs.readdir(migrationsPath);
		const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

		// Check if schema_migrations table exists
		const [tables] = await pool.execute<RowDataPacket[]>("SHOW TABLES LIKE 'schema_migrations'");

		let executedMigrations: MigrationRecord[] = [];
		let tableExists = false;

		if (tables.length > 0) {
			tableExists = true;
			// Get executed migrations
			const [rows] = await pool.execute<MigrationRecord[]>(
				'SELECT version, executed_at, execution_time_ms FROM schema_migrations ORDER BY executed_at DESC'
			);
			executedMigrations = rows;
		}

		// Create a map of executed migrations for quick lookup
		const executedMap = new Map(
			executedMigrations.map(m => [
				m.version,
				{
					executed_at: m.executed_at,
					execution_time_ms: m.execution_time_ms,
				},
			])
		);

		// Build the complete migration status
		const migrations = sqlFiles.map(file => {
			const executed = executedMap.get(file);
			return {
				version: file,
				status: executed ? 'completed' : 'pending',
				executed_at: executed?.executed_at || null,
				execution_time_ms: executed?.execution_time_ms || null,
			};
		});

		// Calculate summary statistics
		const summary = {
			total: migrations.length,
			completed: migrations.filter(m => m.status === 'completed').length,
			pending: migrations.filter(m => m.status === 'pending').length,
			schema_migrations_exists: tableExists,
		};

		return NextResponse.json({
			success: true,
			summary,
			migrations,
			environment: process.env.NODE_ENV,
		});
	} catch (error) {
		console.error('Error fetching migration status:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch migration status',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
