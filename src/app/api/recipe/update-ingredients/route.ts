import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth } from '@/lib/auth-middleware';

interface Ingredient {
	id?: number;
	ingredientId: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
	preparationId?: number;
}

interface UpdateIngredientsRequest {
	recipeId: number;
	ingredients: Ingredient[];
	deletedIngredientIds?: number[];
}

async function updateIngredientsHandler(request: NextRequest) {
	const connection = await pool.getConnection();

	try {
		const body: UpdateIngredientsRequest = await request.json();
		const { recipeId, ingredients, deletedIngredientIds = [] } = body;

		// Validate required fields
		if (!recipeId) {
			return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 });
		}

		// Start transaction
		await connection.beginTransaction();

		// Delete removed ingredients
		if (deletedIngredientIds.length > 0) {
			await connection.execute(`DELETE FROM recipe_ingredients WHERE recipe_id = ? AND id IN (${deletedIngredientIds.map(() => '?').join(',')})`, [
				recipeId,
				...deletedIngredientIds,
			]);
		}

		// Update existing and add new ingredients
		for (const ingredient of ingredients) {
			if (ingredient.id) {
				// Update existing ingredient
				await connection.execute(
					`UPDATE recipe_ingredients 
					 SET ingredient_id = ?, quantity = ?, quantity4 = ?, quantityMeasure_id = ?, preperation_id = ?
					 WHERE id = ? AND recipe_id = ?`,
					[
						ingredient.ingredientId,
						ingredient.quantity,
						ingredient.quantity4,
						ingredient.measureId || null,
						ingredient.preparationId || null,
						ingredient.id,
						recipeId,
					]
				);
			} else {
				// Add new ingredient
				await connection.execute(
					`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, quantity4, quantityMeasure_id, preperation_id, primaryIngredient)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
					[recipeId, ingredient.ingredientId, ingredient.quantity, ingredient.quantity4, ingredient.measureId || null, ingredient.preparationId || null, 0]
				);
			}
		}

		// Commit transaction
		await connection.commit();

		return NextResponse.json({ success: true, message: 'Recipe ingredients updated successfully' });
	} catch (error) {
		// Rollback transaction on error
		await connection.rollback();
		console.error('Error updating recipe ingredients:', error);
		return NextResponse.json({ error: 'Failed to update recipe ingredients' }, { status: 500 });
	} finally {
		connection.release();
	}
}

export const PUT = withAuth(updateIngredientsHandler);
