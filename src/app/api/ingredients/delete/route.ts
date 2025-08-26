import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuthHousehold, AuthenticatedRequest } from '@/lib/auth-middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { canEditResource } from '@/lib/permissions';

interface DeleteIngredientRequest {
	id: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function deleteIngredientHandler(request: AuthenticatedRequest, context?: unknown) {
	try {
		const body: DeleteIngredientRequest = await request.json();
		const { id } = body;

		// Validate required fields
		if (!id) {
			return NextResponse.json({ error: 'Ingredient ID is required' }, { status: 400 });
		}

		// Check if user can delete this ingredient (household ownership)
		const canEdit = await canEditResource(request.household_id, 'ingredients', id);
		if (!canEdit) {
			return NextResponse.json(
				{
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
			[id, request.household_id]
		);

		if (recipeUsage[0].count > 0) {
			return NextResponse.json(
				{
					error: 'Cannot delete ingredient',
					message: `This ingredient is used in ${recipeUsage[0].count} recipe${recipeUsage[0].count > 1 ? 's' : ''}`,
				},
				{ status: 400 }
			);
		}

		// Delete the ingredient (only if owned by household)
		const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM ingredients WHERE id = ? AND household_id = ?`, [id, request.household_id]);

		// Check if deletion was successful
		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Ingredient not found or cannot be deleted' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Ingredient deleted successfully' });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete ingredient' }, { status: 500 });
	}
}

export const DELETE = withAuthHousehold(deleteIngredientHandler);
