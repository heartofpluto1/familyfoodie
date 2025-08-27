import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

async function handler(request: AuthenticatedRequest) {
	try {
		const body = await request.json();
		const { id } = body;

		if (!id) {
			return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
		}

		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();

			// Delete the shopping list item (household-scoped for security)
			const [result] = await connection.execute('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [id, request.household_id]);

			const deleteResult = result as { affectedRows: number };

			if (deleteResult.affectedRows === 0) {
				await connection.rollback();
				return NextResponse.json({ error: 'Item not found' }, { status: 404 });
			}

			await connection.commit();

			return NextResponse.json({ success: true });
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to remove item' }, { status: 500 });
	}
}

export const DELETE = withAuth(handler);
