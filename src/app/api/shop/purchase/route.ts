import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

async function handler(request: AuthenticatedRequest) {
	try {
		const { id, purchased } = await request.json();

		if (!id || typeof purchased !== 'boolean') {
			return NextResponse.json({ error: 'ID and purchased status are required' }, { status: 400 });
		}

		// Update the shopping list item (household-scoped for security)
		await pool.execute('UPDATE shopping_lists SET purchased = ? WHERE id = ? AND household_id = ?', [purchased ? 1 : 0, id, request.household_id]);

		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update shopping list item' }, { status: 500 });
	}
}

export const POST = withAuth(handler);
