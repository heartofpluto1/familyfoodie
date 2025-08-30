import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { requireAuth } from '@/lib/auth/helpers';
import { cleanupRecipeFiles } from '@/lib/utils/secureFilename.server';
import { canEditResource } from '@/lib/permissions';

interface RecipeRow extends RowDataPacket {
	id: number;
	image_filename: string;
	pdf_filename: string;
}

interface PlanRow extends RowDataPacket {
	count: number;
}

interface IngredientRow extends RowDataPacket {
	ingredient_id: number;
}

interface IngredientInfoRow extends RowDataPacket {
	id: number;
	name: string;
}

function validateRecipeId(recipeId: unknown): { isValid: boolean; error?: { success: false; error: string; code: string } } {
	if (recipeId === undefined || recipeId === null || recipeId === '') {
		return { isValid: false, error: { success: false, error: 'Recipe ID is required', code: 'MISSING_RECIPE_ID' } };
	}

	if (typeof recipeId === 'string' && isNaN(Number(recipeId))) {
		return { isValid: false, error: { success: false, error: 'Recipe ID must be a number', code: 'INVALID_RECIPE_ID' } };
	}

	const numericId = Number(recipeId);
	if (!Number.isInteger(numericId)) {
		return { isValid: false, error: { success: false, error: 'Recipe ID must be an integer', code: 'INVALID_RECIPE_ID' } };
	}

	if (numericId <= 0) {
		return { isValid: false, error: { success: false, error: 'Recipe ID must be a positive integer', code: 'INVALID_RECIPE_ID' } };
	}

	return { isValid: true };
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	let recipeId: unknown;
	let collectionId: unknown;

	// Handle JSON parsing with proper error handling
	try {
		const body = await request.json();
		recipeId = body.recipeId;
		collectionId = body.collectionId; // Optional: collection context
	} catch {
		return NextResponse.json({ success: false, error: 'Invalid JSON in request body', code: 'INVALID_JSON' }, { status: 400 });
	}

	// Validate recipe ID
	const validation = validateRecipeId(recipeId);
	if (!validation.isValid) {
		return NextResponse.json(validation.error, { status: 400 });
	}

	const numericRecipeId = parseInt(recipeId as string);
	const numericCollectionId = collectionId ? parseInt(collectionId as string) : null;

	try {
		// Check if user can edit this recipe (household ownership)
		const canEditRecipe = await canEditResource(auth.household_id, 'recipes', numericRecipeId);

		// If user doesn't own the recipe, check if they can remove it from their collection
		if (!canEditRecipe) {
			// If no collection context provided, deny the request
			if (!numericCollectionId) {
				return NextResponse.json(
					{
						success: false,
						error: 'You can only delete recipes owned by your household',
						code: 'PERMISSION_DENIED',
					},
					{ status: 403 }
				);
			}

			// Check if user owns the collection
			const canEditCollection = await canEditResource(auth.household_id, 'collections', numericCollectionId);

			if (!canEditCollection) {
				return NextResponse.json(
					{
						success: false,
						error: 'You can only remove recipes from collections owned by your household',
						code: 'PERMISSION_DENIED',
					},
					{ status: 403 }
				);
			}

			// User owns the collection but not the recipe - just remove from collection
			const [result] = await pool.execute<ResultSetHeader>('DELETE FROM collection_recipes WHERE recipe_id = ? AND collection_id = ?', [
				numericRecipeId,
				numericCollectionId,
			]);

			if (result.affectedRows === 0) {
				return NextResponse.json(
					{
						success: false,
						error: 'Recipe not found in this collection',
						code: 'RECIPE_NOT_IN_COLLECTION',
					},
					{ status: 404 }
				);
			}

			return NextResponse.json({
				success: true,
				message: 'Recipe removed from collection successfully',
				removedFromCollection: true,
				collectionId: numericCollectionId,
			});
		}

		// First, check if the recipe exists and get its filenames
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT id, image_filename, pdf_filename FROM recipes WHERE id = ?', [numericRecipeId]);

		if (recipeRows.length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Recipe not found',
					code: 'RECIPE_NOT_FOUND',
				},
				{ status: 404 }
			);
		}

		const recipe = recipeRows[0];

		// Check if the recipe is used in any planned weeks (household-scoped)
		const [planRows] = await pool.execute<PlanRow[]>('SELECT COUNT(*) as count FROM plans WHERE recipe_id = ? AND household_id = ?', [
			numericRecipeId,
			auth.household_id,
		]);

		if (planRows[0].count > 0) {
			return NextResponse.json(
				{
					success: false,
					error: `Cannot delete recipe: it is used in ${planRows[0].count} planned weeks. Remove it from all planned weeks first.`,
					code: 'PLANNED_WEEKS_EXIST',
					count: planRows[0].count,
				},
				{ status: 400 }
			);
		}

		// Check if any ingredients from this recipe have been used in shopping lists (household-scoped)
		const [shoppingListUsage] = await pool.execute<RowDataPacket[]>(
			`SELECT COUNT(*) as count FROM shopping_lists sl 
			 INNER JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id 
			 WHERE ri.recipe_id = ? AND sl.household_id = ?`,
			[numericRecipeId, auth.household_id]
		);

		const hasShoppingListHistory = shoppingListUsage[0].count > 0;

		if (hasShoppingListHistory) {
			// Recipe has shopping list history - archive it instead of deleting to preserve referential integrity
			const connection = await pool.getConnection();
			try {
				await connection.beginTransaction();

				// Remove recipe from household's collections since it's being archived
				await connection.execute(
					'DELETE FROM collection_recipes WHERE recipe_id = ? AND collection_id IN (SELECT id FROM collections WHERE household_id = ?)',
					[numericRecipeId, auth.household_id]
				);

				await connection.execute('UPDATE recipes SET archived = 1 WHERE id = ?', [numericRecipeId]);

				await connection.commit();

				return NextResponse.json({
					success: true,
					message: 'Recipe archived successfully due to shopping list references',
					archived: true,
					code: 'RECIPE_ARCHIVED',
				});
			} catch (dbError) {
				await connection.rollback();
				throw dbError;
			} finally {
				connection.release();
			}
		} else {
			// No shopping list history - safe to fully delete with proper transaction management
			const connection = await pool.getConnection();
			try {
				await connection.beginTransaction();

				// Get recipe ingredients that will be deleted
				const [recipeIngredients] = await connection.execute<IngredientRow[]>('SELECT ingredient_id FROM recipe_ingredients WHERE recipe_id = ?', [
					numericRecipeId,
				]);
				const ingredientIds = recipeIngredients.map(row => row.ingredient_id);

				// Final safety check - ensure no shopping list references exist
				const [finalSafetyCheck] = await connection.execute<RowDataPacket[]>(
					`SELECT COUNT(*) as count FROM shopping_lists sl 
					 INNER JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id 
					 WHERE ri.recipe_id = ?`,
					[numericRecipeId]
				);

				if (finalSafetyCheck[0].count > 0) {
					// Found shopping list references during deletion - archive instead
					await connection.execute('DELETE FROM collection_recipes WHERE recipe_id = ?', [numericRecipeId]);
					await connection.execute('UPDATE recipes SET archived = 1 WHERE id = ?', [numericRecipeId]);
					await connection.commit();

					return NextResponse.json({
						success: true,
						message: 'Recipe archived successfully due to shopping list references detected during deletion',
						archived: true,
						code: 'RECIPE_ARCHIVED',
					});
				}

				// Delete recipe_ingredients
				await connection.execute<ResultSetHeader>('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [numericRecipeId]);

				// Delete the recipe itself
				const [deleteResult] = await connection.execute<ResultSetHeader>('DELETE FROM recipes WHERE id = ?', [numericRecipeId]);

				if (deleteResult.affectedRows === 0) {
					throw new Error('Failed to delete recipe from database');
				}

				// Find and delete orphaned ingredients for this household
				const deletedIngredientNames: string[] = [];
				let deletedIngredientsCount = 0;

				for (const ingredientId of ingredientIds) {
					// Check if this ingredient is still used by other recipes in this household
					const [usageCheck] = await connection.execute<RowDataPacket[]>(
						`SELECT COUNT(*) as count FROM recipe_ingredients ri
						 JOIN recipes r ON ri.recipe_id = r.id
						 WHERE ri.ingredient_id = ? AND r.household_id = ?`,
						[ingredientId, auth.household_id]
					);

					// Also check if it's used in shopping lists
					const [shoppingCheck] = await connection.execute<RowDataPacket[]>(
						`SELECT COUNT(*) as count FROM shopping_lists sl
						 WHERE sl.ingredient_id = ? AND sl.household_id = ?`,
						[ingredientId, auth.household_id]
					);

					if (usageCheck[0].count === 0 && shoppingCheck[0].count === 0) {
						// Ingredient is orphaned - get its name before deleting
						const [ingredientInfo] = await connection.execute<IngredientInfoRow[]>('SELECT name FROM ingredients WHERE id = ? AND household_id = ?', [
							ingredientId,
							auth.household_id,
						]);

						if (ingredientInfo.length > 0) {
							// Delete the orphaned ingredient
							const [deleteIngResult] = await connection.execute<ResultSetHeader>('DELETE FROM ingredients WHERE id = ? AND household_id = ?', [
								ingredientId,
								auth.household_id,
							]);

							if (deleteIngResult.affectedRows > 0) {
								deletedIngredientNames.push(ingredientInfo[0].name);
								deletedIngredientsCount++;
							}
						}
					}
				}

				await connection.commit();

				// Delete associated files after successful database deletion
				let warning: string | undefined;
				try {
					await cleanupRecipeFiles(recipe.image_filename, recipe.pdf_filename);
				} catch (cleanupError) {
					warning = `File cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`;
				}

				let message = 'Recipe deleted successfully';
				if (deletedIngredientsCount > 0) {
					message += ` and cleaned up ${deletedIngredientsCount} unused ingredient${deletedIngredientsCount === 1 ? '' : 's'}`;
					if (deletedIngredientNames.length > 0) {
						message += ` (${deletedIngredientNames.join(', ')})`;
					}
				}

				return NextResponse.json({
					success: true,
					message,
					deletedIngredientsCount,
					deletedIngredientNames,
					...(warning && { warning }),
				});
			} catch (error) {
				await connection.rollback();
				throw error;
			} finally {
				connection.release();
			}
		}
	} catch (error) {
		const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: unknown }).code : undefined;
		const errorMessage = error instanceof Error ? error.message : 'Failed to delete recipe';
		let responseCode = 'SERVER_ERROR';

		if (errorCode === 'DELETE_FAILED') {
			responseCode = 'DELETE_FAILED';
		} else if (
			errorCode === 'DATABASE_ERROR' ||
			errorMessage.includes('Pool exhausted') ||
			errorMessage.includes('Database constraint violation') ||
			errorMessage.includes('Connection') ||
			errorMessage.includes('ECONNREFUSED')
		) {
			responseCode = 'DATABASE_ERROR';
		}

		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
				code: responseCode,
			},
			{ status: 500 }
		);
	}
}
