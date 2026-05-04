import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

export async function requireAuth() {
	try {
		const session = await auth();

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
	} catch {
		return {
			authorized: false as const,
			response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
		};
	}
}

export async function requireAdminAuth() {
	try {
		const session = await auth();

		if (!session || !session.user?.household_id) {
			return {
				authorized: false as const,
				response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			};
		}

		const [rows] = await pool.execute<RowDataPacket[]>('SELECT is_admin FROM users WHERE id = ?', [session.user.id]);

		const isAdmin = rows.length > 0 && (rows[0].is_admin === 1 || rows[0].is_admin === true);

		if (!isAdmin) {
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
	} catch {
		return {
			authorized: false as const,
			response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
		};
	}
}
