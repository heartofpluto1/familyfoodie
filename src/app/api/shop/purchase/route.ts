import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { requireAuth } from '@/lib/auth/helpers';

export async function POST(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		let body;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid request format',
					code: 'INVALID_REQUEST_FORMAT',
				},
				{ status: 400 }
			);
		}

		const { id, ids, purchased } = body;

		// Handle both single ID and multiple IDs for backward compatibility
		const itemIds = ids || (id ? [id] : null);

		// Validate required fields
		const missingFields = [];
		if (!itemIds || itemIds.length === 0) missingFields.push('id');
		if (purchased === null || purchased === undefined) missingFields.push('purchased');

		if (missingFields.length > 0) {
			if (missingFields.length === 1) {
				const field = missingFields[0];
				return NextResponse.json(
					{
						success: false,
						error: field === 'id' ? 'Item ID(s) required' : 'Purchased status is required',
						code: 'VALIDATION_ERROR',
					},
					{ status: 400 }
				);
			}
			return NextResponse.json(
				{
					success: false,
					error: 'Item ID(s) and purchased status are required',
					code: 'VALIDATION_ERROR',
				},
				{ status: 400 }
			);
		}

		// Validate purchased is a boolean
		if (typeof purchased !== 'boolean') {
			return NextResponse.json(
				{
					success: false,
					error: 'Purchased status must be a boolean',
					code: 'VALIDATION_ERROR',
				},
				{ status: 400 }
			);
		}

		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();

			// Update all shopping list items (household-scoped for security)
			const placeholders = itemIds.map(() => '?').join(',');
			const [result] = await connection.execute(`UPDATE shopping_lists SET purchased = ? WHERE id IN (${placeholders}) AND household_id = ?`, [
				purchased ? 1 : 0,
				...itemIds,
				auth.household_id,
			]);

			const updateResult = result as { affectedRows: number };

			// Check if any items were found and updated
			if (updateResult.affectedRows === 0) {
				await connection.rollback();
				// Generic message to prevent information leakage
				// (doesn't reveal if item exists in another household)
				return NextResponse.json(
					{
						success: false,
						error: 'Item(s) not found',
						code: 'RESOURCE_NOT_FOUND',
					},
					{ status: 404 }
				);
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
		// Handle specific error types
		if (error instanceof Error) {
			if (error.message.includes('Connection pool exhausted')) {
				return NextResponse.json(
					{
						success: false,
						error: 'Database connection error',
						code: 'DATABASE_CONNECTION_ERROR',
					},
					{ status: 500 }
				);
			}
		}

		// Default to sanitized error messages for security
		return NextResponse.json(
			{
				success: false,
				error: 'Internal server error occurred',
				code: 'INTERNAL_ERROR',
			},
			{ status: 500 }
		);
	}
}
