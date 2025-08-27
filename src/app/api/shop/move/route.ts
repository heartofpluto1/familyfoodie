import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { ResultSetHeader } from 'mysql2';

async function handler(request: AuthenticatedRequest) {
	try {
		const body = await request.json();
		const { id, fresh, sort, week, year } = body;

		// Input validation
		if (!id || fresh === undefined || sort === undefined || !week || !year) {
			return NextResponse.json(
				{
					success: false,
					error: 'Missing required fields',
					code: 'VALIDATION_ERROR',
					details: 'All fields (id, fresh, sort, week, year) are required',
				},
				{ status: 400 }
			);
		}

		// Validate sort value (non-negative, reasonable upper bound)
		if (typeof sort !== 'number' || sort < 0 || sort > 1000) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid sort value',
					code: 'VALIDATION_ERROR',
					details: 'Sort value must be a number between 0 and 1000',
				},
				{ status: 400 }
			);
		}

		// Validate other numeric fields
		if (typeof id !== 'number' || id <= 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid item ID',
					code: 'VALIDATION_ERROR',
					details: 'Item ID must be a positive number',
				},
				{ status: 400 }
			);
		}

		if (typeof week !== 'number' || week < 1 || week > 53) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid week number',
					code: 'VALIDATION_ERROR',
					details: 'Week must be a number between 1 and 53',
				},
				{ status: 400 }
			);
		}

		if (typeof year !== 'number' || year < 2020 || year > 2100) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid year',
					code: 'VALIDATION_ERROR',
					details: 'Year must be between 2020 and 2100',
				},
				{ status: 400 }
			);
		}

		if (typeof fresh !== 'boolean') {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid fresh value',
					code: 'VALIDATION_ERROR',
					details: 'Fresh must be a boolean value',
				},
				{ status: 400 }
			);
		}

		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();

			// Update the moved item (household-scoped)
			const [updateResult] = await connection.execute<ResultSetHeader>(
				'UPDATE shopping_lists SET fresh = ?, sort = ? WHERE id = ? AND week = ? AND year = ? AND household_id = ?',
				[fresh, sort, id, week, year, request.household_id]
			);

			// Check if the item was actually updated (exists and belongs to user's household)
			if (updateResult.affectedRows === 0) {
				await connection.rollback();
				return NextResponse.json(
					{
						success: false,
						error: 'Item not found or access denied',
						code: 'ITEM_NOT_FOUND',
						details: `Shopping list item with ID ${id} not found in week ${week}/${year} for your household`,
					},
					{ status: 404 }
				);
			}

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
			return NextResponse.json({ success: true, message: 'Item moved successfully' });
		} catch (error) {
			await connection.rollback();
			console.error('Database error during shopping list move:', error);
			return NextResponse.json(
				{
					success: false,
					error: 'Database operation failed',
					code: 'DATABASE_ERROR',
					details: error instanceof Error ? error.message : 'Failed to update shopping list item positions',
				},
				{ status: 500 }
			);
		} finally {
			connection.release();
		}
	} catch (error) {
		console.error('Error in shop/move handler:', error);

		// Handle JSON parsing errors specifically
		if (error instanceof SyntaxError && error.message.includes('JSON')) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid request format',
					code: 'INVALID_JSON',
					details: 'Request body must be valid JSON',
				},
				{ status: 400 }
			);
		}

		// Handle connection errors
		if (error instanceof Error && error.message.includes('connection')) {
			return NextResponse.json(
				{
					success: false,
					error: 'Database connection failed',
					code: 'CONNECTION_ERROR',
					details: 'Unable to connect to database. Please try again later.',
				},
				{ status: 503 }
			);
		}

		// Generic error response
		return NextResponse.json(
			{
				success: false,
				error: 'Internal server error',
				code: 'INTERNAL_ERROR',
				details: error instanceof Error ? error.message : 'An unexpected error occurred',
			},
			{ status: 500 }
		);
	}
}

export const PUT = withAuth(handler);
