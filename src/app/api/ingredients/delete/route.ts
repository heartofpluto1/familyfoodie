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
		const [recipeUsage] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as count FROM menus_recipeingredient WHERE ingredient_id = ?`, [id]);

		if (recipeUsage[0].count > 0) {
			return NextResponse.json(
				{
					error: 'Cannot delete ingredient',
					message: `This ingredient is used in ${recipeUsage[0].count} recipe${recipeUsage[0].count > 1 ? 's' : ''}`,
				},
				{ status: 400 }
			);
		}

		// Delete the ingredient from account ingredients first (if any exist)
		await pool.execute(`DELETE FROM menus_accountingredient WHERE ingredient_id = ?`, [id]);

		// Delete the ingredient
		const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM menus_ingredient WHERE id = ? AND public = 1`, [id]);

		// Check if deletion was successful
		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Ingredient not found or cannot be deleted' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Ingredient deleted successfully' });
	} catch (error) {
		console.error('Error deleting ingredient:', error);
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete ingredient' }, { status: 500 });
	}
}

export const DELETE = withAuth(deleteIngredientHandler);
