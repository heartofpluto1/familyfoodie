import { getServerSession } from 'next-auth';
import { authOptions } from './config';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Require authenticated user for API routes
 */
export async function requireAuth() {
	const session = await getServerSession(authOptions);

	if (!session || !session.user?.household_id) {
		return {
			authorized: false as const,
			response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
		};
	}

	return {
		authorized: true as const,
		session,
		household_id: session.user.household_id,
		user_id: session.user.id,
	};
}

/**
 * Require admin user for API routes
 */
export async function requireAdminAuth() {
	const session = await getServerSession(authOptions);

	if (!session || !session.user?.household_id) {
		return {
			authorized: false as const,
			response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
		};
	}

	// Check if user is admin in database
	const [rows] = await pool.execute<RowDataPacket[]>('SELECT is_admin FROM users WHERE id = ?', [session.user.id]);

	if (rows.length === 0 || !rows[0].is_admin) {
		return {
			authorized: false as const,
			response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
		};
	}

	return {
		authorized: true as const,
		session,
		household_id: session.user.household_id,
		user_id: session.user.id,
		is_admin: true,
	};
}
