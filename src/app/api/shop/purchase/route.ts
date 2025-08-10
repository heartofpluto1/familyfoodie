import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth } from '@/lib/auth-middleware';

async function handler(request: NextRequest) {
	try {
		const { id, purchased } = await request.json();

		if (!id || typeof purchased !== 'boolean') {
			return NextResponse.json({ error: 'ID and purchased status are required' }, { status: 400 });
		}

		// Update the shopping list item
		await pool.execute('UPDATE menus_shoppinglist SET purchased = ? WHERE id = ? AND account_id = 1', [purchased ? 1 : 0, id]);

		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update shopping list item' }, { status: 500 });
	}
}

export const POST = withAuth(handler);
