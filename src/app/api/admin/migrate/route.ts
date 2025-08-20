import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import runMigrations from '../../../../../migrations/run-migrations.mjs';

async function postHandler(request: NextRequest) {
	try {
		// Additional check for migration token in production
		// This adds an extra layer of security beyond session auth
		if (process.env.NODE_ENV === 'production') {
			const authHeader = request.headers.get('x-migration-token');

			if (!process.env.MIGRATION_TOKEN || authHeader !== process.env.MIGRATION_TOKEN) {
				return NextResponse.json({ error: 'Invalid migration token' }, { status: 403 });
			}
		}

		console.log('Starting migrations via API...');
		const result = await runMigrations();

		return NextResponse.json({
			success: true,
			message: `Successfully ran ${result.migrationsRun} migration(s)`,
			migrationsRun: result.migrationsRun,
		});
	} catch (error) {
		console.error('Migration API error:', error);
		return NextResponse.json(
			{
				error: 'Migration failed',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}

async function getHandler() {
	try {
		// Check migration status without running them
		// Useful for monitoring
		return NextResponse.json({
			status: 'ready',
			message: 'Migration endpoint is available',
			environment: process.env.NODE_ENV,
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to check migration status' }, { status: 500 });
	}
}

export const POST = withAuth(postHandler);
export const GET = withAuth(getHandler);
