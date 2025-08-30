import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { requireAuth } from '@/lib/auth/helpers';
import { cascadeCopyWithContext } from '@/lib/copy-on-write';
import { canEditResource, validateRecipeInCollection } from '@/lib/permissions';
import { copyIngredientForEdit } from '@/lib/copy-on-write';

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
	collectionId: number; // Required for cascade copy context
	ingredients: Ingredient[];
	deletedIngredientIds?: number[];
}

// Helper function for standardized error responses
function createErrorResponse(error: string, code: string, status: number, details?: object) {
	return NextResponse.json(
		{
			success: false,
			error,
			code,
			...(details && { details }),
		},
		{ status }
	);
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}
	const connection = await pool.getConnection();

	try {
		// Parse and validate JSON payload
		let body: UpdateIngredientsRequest;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
		}

		const { recipeId, collectionId, ingredients, deletedIngredientIds = [] } = body;

		// Validate required fields
		if (!recipeId || !collectionId) {
			return createErrorResponse('Recipe ID and collection ID are required', 'VALIDATION_ERROR', 400);
		}

		// Validate ID types
		if (typeof recipeId !== 'number' || !Number.isInteger(recipeId) || recipeId <= 0) {
			return createErrorResponse('Invalid recipe ID format', 'VALIDATION_ERROR', 400);
		}
		if (typeof collectionId !== 'number' || !Number.isInteger(collectionId) || collectionId <= 0) {
			return createErrorResponse('Invalid collection ID format', 'VALIDATION_ERROR', 400);
		}

		// Validate ingredient data structure
		for (const ingredient of ingredients) {
			if (!ingredient.ingredientId) {
				return createErrorResponse('Ingredient ID is required for all ingredients', 'VALIDATION_ERROR', 400);
			}
			if (typeof ingredient.ingredientId !== 'number') {
				return createErrorResponse('Invalid ingredient data format', 'VALIDATION_ERROR', 400);
			}
		}

		// Validate that the recipe belongs to the specified collection and household has access
		const isRecipeInCollection = await validateRecipeInCollection(recipeId, collectionId, auth.household_id);
		if (!isRecipeInCollection) {
			return createErrorResponse('Recipe not found', 'RECIPE_NOT_FOUND', 404);
		}

		// Check if the user owns the recipe
		const canEditRecipe = await canEditResource(auth.household_id, 'recipes', recipeId);

		let targetRecipeId = recipeId;
		let actionsTaken: string[] = [];

		// If user doesn't own the recipe, trigger cascade copy with context
		let newRecipeSlug: string | undefined;
		let newCollectionSlug: string | undefined;

		if (!canEditRecipe) {
			const cascadeResult = await cascadeCopyWithContext(auth.household_id, collectionId, recipeId);

			targetRecipeId = cascadeResult.newRecipeId;
			actionsTaken = cascadeResult.actionsTaken;
			newRecipeSlug = cascadeResult.newRecipeSlug;
			newCollectionSlug = cascadeResult.newCollectionSlug;
		}

		// Initialize operation counters
		let deletedCount = 0;
		let updatedCount = 0;
		let addedCount = 0;

		// Start transaction
		await connection.beginTransaction();

		// Delete removed ingredients from the target recipe
		if (deletedIngredientIds.length > 0) {
			// If we copied the recipe, we need to find the corresponding ingredient IDs in the new recipe
			if (targetRecipeId !== recipeId) {
				// Map old ingredient IDs to new ones in the copied recipe
				const placeholders = deletedIngredientIds.map(() => '?').join(',');
				const [mappedIngredients] = await connection.execute<RowDataPacket[]>(
					`SELECT ri_new.id as new_id
					 FROM recipe_ingredients ri_old
					 JOIN recipe_ingredients ri_new ON ri_new.ingredient_id = ri_old.ingredient_id
					 WHERE ri_old.id IN (${placeholders})
					 AND ri_old.recipe_id = ?
					 AND ri_new.recipe_id = ?`,
					[...deletedIngredientIds, recipeId, targetRecipeId]
				);

				if (mappedIngredients.length > 0) {
					const newIds = mappedIngredients.map(row => row.new_id);
					const newPlaceholders = newIds.map(() => '?').join(',');
					const [result] = await connection.execute<ResultSetHeader>(`DELETE FROM recipe_ingredients WHERE id IN (${newPlaceholders})`, newIds);
					deletedCount = result.affectedRows || 0;
				}
			} else {
				// Original logic for owned recipes
				const [result] = await connection.execute<ResultSetHeader>(
					`DELETE FROM recipe_ingredients WHERE recipe_id = ? AND id IN (${deletedIngredientIds.map(() => '?').join(',')})`,
					[targetRecipeId, ...deletedIngredientIds]
				);
				deletedCount = result.affectedRows || 0;
			}
		}

		// Update existing and add new ingredients
		for (const ingredient of ingredients) {
			// Check if user owns the ingredient
			const canEditIngredient = await canEditResource(auth.household_id, 'ingredients', ingredient.ingredientId);
			let targetIngredientId = ingredient.ingredientId;

			// Copy ingredient if not owned
			if (!canEditIngredient) {
				const ingredientCopyResult = await copyIngredientForEdit(ingredient.ingredientId, auth.household_id);
				targetIngredientId = ingredientCopyResult.newId;
				if (ingredientCopyResult.copied) {
					actionsTaken.push('ingredient_copied');
				}
			}

			if (ingredient.id) {
				// Update existing ingredient
				let targetIngredientRowId = ingredient.id;

				// If we copied the recipe, find the corresponding recipe_ingredient row
				if (targetRecipeId !== recipeId) {
					const [mappedRow] = await connection.execute<RowDataPacket[]>(
						`SELECT ri_new.id as new_id
						 FROM recipe_ingredients ri_old
						 JOIN recipe_ingredients ri_new ON ri_new.ingredient_id = ri_old.ingredient_id
						 WHERE ri_old.id = ?
						 AND ri_old.recipe_id = ?
						 AND ri_new.recipe_id = ?`,
						[ingredient.id, recipeId, targetRecipeId]
					);

					if (mappedRow.length > 0) {
						targetIngredientRowId = mappedRow[0].new_id;
					}
				}

				const [result] = await connection.execute<ResultSetHeader>(
					`UPDATE recipe_ingredients 
					 SET ingredient_id = ?, quantity = ?, quantity4 = ?, quantityMeasure_id = ?, preperation_id = ?
					 WHERE id = ? AND recipe_id = ?`,
					[
						targetIngredientId,
						ingredient.quantity,
						ingredient.quantity4,
						ingredient.measureId || null,
						ingredient.preparationId || null,
						targetIngredientRowId,
						targetRecipeId,
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
					[
						targetRecipeId,
						targetIngredientId,
						ingredient.quantity,
						ingredient.quantity4,
						ingredient.measureId || null,
						ingredient.preparationId || null,
						0,
					]
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
			data: {
				targetRecipeId,
				newRecipeSlug,
				newCollectionSlug,
				actionsTaken,
				redirectNeeded: actionsTaken.includes('recipe_copied') || actionsTaken.includes('collection_copied'),
			},
		});
	} catch (error) {
		// Rollback transaction on error
		await connection.rollback();

		console.error('Error updating recipe ingredients:', error);

		// Check for foreign key constraint errors
		if (error instanceof Error && error.message.includes('foreign key constraint fails')) {
			return createErrorResponse('Invalid ingredient ID provided', 'INVALID_INGREDIENT_ID', 400);
		}

		return createErrorResponse('Failed to update recipe ingredients', 'SERVER_ERROR', 500);
	} finally {
		connection.release();
	}
}
