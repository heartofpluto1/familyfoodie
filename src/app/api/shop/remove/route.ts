import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { requireAuth } from '@/lib/auth/helpers';

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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

		const { id } = body;

		if (id === null || id === undefined || id === '') {
			return NextResponse.json(
				{
					success: false,
					error: 'Item ID is required',
					code: 'VALIDATION_ERROR',
				},
				{ status: 400 }
			);
		}

		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();

			// Delete the shopping list item (household-scoped for security)
			const [result] = await connection.execute('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [id, auth.household_id]);

			const deleteResult = result as { affectedRows: number };

			if (deleteResult.affectedRows === 0) {
				await connection.rollback();
				return NextResponse.json(
					{
						success: false,
						error: 'Item not found',
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
