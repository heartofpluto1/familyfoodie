import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth } from '@/lib/auth-middleware';

async function handler(request: NextRequest) {
	try {
		const body = await request.json();
		const { id } = body;

		if (!id) {
			return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
		}

		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();

			// Delete the shopping list item
			const [result] = await connection.execute('DELETE FROM menus_shoppinglist WHERE id = ?', [id]);

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
