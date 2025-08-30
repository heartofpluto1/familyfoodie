import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { requireAuth } from '@/lib/auth/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { canEditResource } from '@/lib/permissions';

interface DeleteIngredientRequest {
	id: number;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const body: DeleteIngredientRequest = await request.json();
		const { id } = body;

		// Validate required fields
		if (!id) {
			return NextResponse.json(
				{
					success: false,
					error: 'Ingredient ID is required',
					code: 'MISSING_INGREDIENT_ID',
				},
				{ status: 400 }
			);
		}

		// Check if user can delete this ingredient (household ownership)
		const canEdit = await canEditResource(auth.household_id, 'ingredients', id);
		if (!canEdit) {
			return NextResponse.json(
				{
					success: false,
					error: 'You can only delete ingredients owned by your household',
					code: 'PERMISSION_DENIED',
				},
				{ status: 403 }
			);
		}

		// Check if the ingredient is used in any recipes within the household
		const [recipeUsage] = await pool.execute<RowDataPacket[]>(
			`SELECT COUNT(*) as count 
			 FROM recipe_ingredients ri
			 JOIN recipes r ON ri.recipe_id = r.id
			 WHERE ri.ingredient_id = ? AND r.household_id = ?`,
			[id, auth.household_id]
		);

		if (recipeUsage[0].count > 0) {
			return NextResponse.json(
				{
					success: false,
					error: `Cannot delete ingredient: it is used in ${recipeUsage[0].count} recipe${recipeUsage[0].count > 1 ? 's' : ''}`,
					code: 'INGREDIENT_IN_USE',
					count: recipeUsage[0].count,
				},
				{ status: 400 }
			);
		}

		// Delete the ingredient (only if owned by household)
		const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM ingredients WHERE id = ? AND household_id = ?`, [id, auth.household_id]);

		// Check if deletion was successful
		if (result.affectedRows === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Ingredient not found',
					code: 'INGREDIENT_NOT_FOUND',
				},
				{ status: 404 }
			);
		}

		return NextResponse.json({ success: true, message: 'Ingredient deleted successfully' });
	} catch (error) {
		// Handle different types of errors with appropriate codes
		if (error instanceof Error) {
			// Check for specific error types
			if (error.message.includes('Permission check failed') || error.message.includes('canEditResource')) {
				return NextResponse.json(
					{
						success: false,
						error: error.message,
						code: 'PERMISSION_CHECK_FAILED',
					},
					{ status: 500 }
				);
			}

			// Check for JSON parsing errors
			if (error.message.includes('Unexpected') || error.message.includes('JSON')) {
				return NextResponse.json(
					{
						success: false,
						error: error.message,
						code: 'INVALID_JSON',
					},
					{ status: 500 }
				);
			}

			// Database errors
			if (error.message.includes('Database') || error.message.includes('connection') || error.message.includes('execute')) {
				return NextResponse.json(
					{
						success: false,
						error: error.message,
						code: 'DATABASE_ERROR',
					},
					{ status: 500 }
				);
			}

			// Generic error with message
			return NextResponse.json(
				{
					success: false,
					error: error.message,
					code: 'DATABASE_ERROR', // Most errors in this context are likely database related
				},
				{ status: 500 }
			);
		} else {
			// Non-Error objects
			return NextResponse.json(
				{
					success: false,
					error: 'Failed to delete ingredient',
					code: 'INTERNAL_SERVER_ERROR',
				},
				{ status: 500 }
			);
		}
	}
}
