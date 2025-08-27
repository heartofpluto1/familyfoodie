import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

async function handler(request: AuthenticatedRequest) {
	try {
		const body = await request.json();
		const { id, fresh, sort, week, year } = body;

		if (!id || fresh === undefined || sort === undefined || !week || !year) {
			return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
		}

		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();

			// Update the moved item (household-scoped)
			await connection.execute('UPDATE shopping_lists SET fresh = ?, sort = ? WHERE id = ? AND week = ? AND year = ? AND household_id = ?', [
				fresh,
				sort,
				id,
				week,
				year,
				request.household_id,
			]);

			// Get all items in the target list (fresh or pantry) for this week/year/household
			const [items] = await connection.execute(
				'SELECT id, sort FROM shopping_lists WHERE fresh = ? AND week = ? AND year = ? AND household_id = ? AND id != ? ORDER BY sort ASC',
				[fresh, week, year, request.household_id, id]
			);

			// Update sort values for items that need to be shifted
			const itemsArray = items as { id: number; sort: number }[];
			for (let i = 0; i < itemsArray.length; i++) {
				const item = itemsArray[i];
				let newSort = i;

				// If the moved item should be inserted before this position, increment
				if (i >= sort) {
					newSort = i + 1;
				}

				if (item.sort !== newSort) {
					await connection.execute('UPDATE shopping_lists SET sort = ? WHERE id = ?', [newSort, item.id]);
				}
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
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to move item' }, { status: 500 });
	}
}

export const PUT = withAuth(handler);
