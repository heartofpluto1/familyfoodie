import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth } from '@/lib/auth-middleware';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface DeleteIngredientRequest {
	id: number;
}

async function deleteIngredientHandler(request: NextRequest) {
	try {
		const body: DeleteIngredientRequest = await request.json();
		const { id } = body;

		// Validate required fields
		if (!id) {
			return NextResponse.json({ error: 'Ingredient ID is required' }, { status: 400 });
		}

		// Check if the ingredient is used in any recipes
		const [recipeUsage] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as count FROM recipe_ingredients WHERE ingredient_id = ?`, [id]);

		if (recipeUsage[0].count > 0) {
			return NextResponse.json(
				{
					error: 'Cannot delete ingredient',
					message: `This ingredient is used in ${recipeUsage[0].count} recipe${recipeUsage[0].count > 1 ? 's' : ''}`,
				},
				{ status: 400 }
			);
		}

		// Account ingredients table no longer exists

		// Delete the ingredient
		const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM ingredients WHERE id = ? AND public = 1`, [id]);

		// Check if deletion was successful
		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Ingredient not found or cannot be deleted' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Ingredient deleted successfully' });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete ingredient' }, { status: 500 });
	}
}

export const DELETE = withAuth(deleteIngredientHandler);
