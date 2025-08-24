import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
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
		// Parse and validate JSON payload
		let body: UpdateIngredientsRequest;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
		}

		const { recipeId, ingredients, deletedIngredientIds = [] } = body;

		// Validate required fields
		if (!recipeId) {
			return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 });
		}

		// Validate ingredient data structure
		for (const ingredient of ingredients) {
			if (!ingredient.ingredientId) {
				return NextResponse.json({ error: 'Ingredient ID is required for all ingredients' }, { status: 400 });
			}
			if (typeof ingredient.ingredientId !== 'number') {
				return NextResponse.json({ error: 'Invalid ingredient data format' }, { status: 400 });
			}
		}

		// Initialize operation counters
		let deletedCount = 0;
		let updatedCount = 0;
		let addedCount = 0;

		// Start transaction
		await connection.beginTransaction();

		// Delete removed ingredients
		if (deletedIngredientIds.length > 0) {
			const [result] = await connection.execute<ResultSetHeader>(
				`DELETE FROM recipe_ingredients WHERE recipe_id = ? AND id IN (${deletedIngredientIds.map(() => '?').join(',')})`,
				[recipeId, ...deletedIngredientIds]
			);
			deletedCount = result.affectedRows || 0;
		}

		// Update existing and add new ingredients
		for (const ingredient of ingredients) {
			if (ingredient.id) {
				// Update existing ingredient
				const [result] = await connection.execute<ResultSetHeader>(
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
				if (result.affectedRows > 0) {
					updatedCount++;
				}
			} else {
				// Add new ingredient
				const [result] = await connection.execute<ResultSetHeader>(
					`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, quantity4, quantityMeasure_id, preperation_id, primaryIngredient)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
					[recipeId, ingredient.ingredientId, ingredient.quantity, ingredient.quantity4, ingredient.measureId || null, ingredient.preparationId || null, 0]
				);
				if (result.insertId) {
					addedCount++;
				}
			}
		}

		// Commit transaction
		await connection.commit();

		// Calculate final ingredient count
		const ingredientsCount = addedCount + updatedCount;

		return NextResponse.json({
			success: true,
			message: 'Recipe ingredients updated successfully',
			operations: {
				updated: updatedCount,
				added: addedCount,
				deleted: deletedCount,
			},
			ingredientsCount,
		});
	} catch (error) {
		// Rollback transaction on error
		await connection.rollback();

		// Check for foreign key constraint errors
		if (error instanceof Error && error.message.includes('foreign key constraint fails')) {
			return NextResponse.json({ error: 'Invalid ingredient ID provided' }, { status: 400 });
		}

		return NextResponse.json({ error: 'Failed to update recipe ingredients' }, { status: 500 });
	} finally {
		connection.release();
	}
}

export const PUT = withAuth(updateIngredientsHandler);
