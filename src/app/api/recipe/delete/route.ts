import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { cleanupRecipeFiles } from '@/lib/utils/secureFilename.server';

interface RecipeRow extends RowDataPacket {
	id: number;
	image_filename: string;
	pdf_filename: string;
}

interface PlanRow extends RowDataPacket {
	count: number;
}

function validateRecipeId(recipeId: any): { isValid: boolean; error?: any } {
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

async function deleteHandler(request: NextRequest) {
	let recipeId: any;
	
	// Handle JSON parsing with proper error handling
	try {
		const body = await request.json();
		recipeId = body.recipeId;
	} catch (jsonError) {
		return NextResponse.json(
			{ success: false, error: 'Invalid JSON in request body', code: 'INVALID_JSON' },
			{ status: 400 }
		);
	}

	// Validate recipe ID
	const validation = validateRecipeId(recipeId);
	if (!validation.isValid) {
		return NextResponse.json(validation.error, { status: 400 });
	}

	try {

		// First, check if the recipe exists and get its filenames
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT id, image_filename, pdf_filename FROM recipes WHERE id = ?', [parseInt(recipeId)]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ 
				success: false, 
				error: 'Recipe not found', 
				code: 'RECIPE_NOT_FOUND' 
			}, { status: 404 });
		}

		const recipe = recipeRows[0];

		// Check if the recipe is used in any planned weeks
		const [planRows] = await pool.execute<PlanRow[]>('SELECT COUNT(*) as count FROM plans WHERE recipe_id = ?', [parseInt(recipeId)]);

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

		// Check if any ingredients from this recipe have been used in shopping lists
		const [shoppingListUsage] = await pool.execute<RowDataPacket[]>(
			`SELECT COUNT(*) as count FROM shopping_lists sl 
			 INNER JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id 
			 WHERE ri.recipe_id = ?`,
			[parseInt(recipeId)]
		);

		const hasShoppingListHistory = shoppingListUsage[0].count > 0;

		// Get a connection for transaction handling
		const connection = await pool.getConnection();

		try {
			// Start transaction
			await connection.beginTransaction();

			if (hasShoppingListHistory) {
				// Recipe has shopping list history - archive it instead of deleting
				// Archive functionality removed - recipes can no longer be archived
				await connection.rollback();
				return NextResponse.json(
					{
						success: false,
						error: 'Cannot delete recipe with existing shopping list history',
						code: 'SHOPPING_HISTORY_EXISTS',
					},
					{ status: 400 }
				);
			} else {
				// No shopping list history - safe to fully delete

				// First, get all ingredients used by this recipe so we can check for unused ones later
				const [recipeIngredients] = await connection.execute<RowDataPacket[]>('SELECT DISTINCT ingredient_id FROM recipe_ingredients WHERE recipe_id = ?', [
					parseInt(recipeId),
				]);
				const ingredientIds = recipeIngredients.map(row => row.ingredient_id);

				// Delete recipe ingredients first (foreign key constraint)
				await connection.execute('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [parseInt(recipeId)]);

				// Account associations no longer exist - recipes are globally available

				// Delete the recipe
				const [deleteResult] = await connection.execute<ResultSetHeader>('DELETE FROM recipes WHERE id = ?', [parseInt(recipeId)]);

				if (deleteResult.affectedRows === 0) {
					const error = new Error('Failed to delete recipe from database');
					(error as any).code = 'DELETE_FAILED';
					throw error;
				}

				// Now check for unused ingredients and delete them
				let deletedIngredientsCount = 0;
				const deletedIngredientNames: string[] = [];

				for (const ingredientId of ingredientIds) {
					// Check if this ingredient is used in any other recipes
					const [otherRecipeUse] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM recipe_ingredients WHERE ingredient_id = ?', [
						ingredientId,
					]);

					// Account ingredients table no longer exists

					// Check if this ingredient has been used in shopping lists (via recipeingredient)
					const [shoppingListUse] = await connection.execute<RowDataPacket[]>(
						`SELECT COUNT(*) as count FROM shopping_lists sl 
						 INNER JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id 
						 WHERE ri.ingredient_id = ?`,
						[ingredientId]
					);

					// If ingredient is not used anywhere else, delete it
					if (otherRecipeUse[0].count === 0 && shoppingListUse[0].count === 0) {
						// Get ingredient name for logging
						const [ingredientName] = await connection.execute<RowDataPacket[]>('SELECT name FROM ingredients WHERE id = ?', [ingredientId]);

						// Delete the unused ingredient
						const [ingredientDeleteResult] = await connection.execute<ResultSetHeader>('DELETE FROM ingredients WHERE id = ?', [ingredientId]);

						if (ingredientDeleteResult.affectedRows > 0) {
							deletedIngredientsCount++;
							if (ingredientName.length > 0) {
								deletedIngredientNames.push(ingredientName[0].name);
							}
						}
					}
				}

				// Commit the database transaction
				await connection.commit();

				// Delete associated files after successful database deletion (with defensive cleanup)
				let warning: string | undefined;
				try {
					const cleanupResult = await cleanupRecipeFiles(recipe.image_filename, recipe.pdf_filename);
					console.log(`File cleanup: ${cleanupResult}`);
				} catch (cleanupError) {
					warning = `File cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`;
					console.warn('File cleanup failed:', cleanupError);
				}

				let message = 'Recipe deleted successfully';
				if (deletedIngredientsCount > 0) {
					message += ` and cleaned up ${deletedIngredientsCount} unused ingredient${deletedIngredientsCount === 1 ? '' : 's'}`;
					if (deletedIngredientNames.length > 0) {
						message += ` (${deletedIngredientNames.join(', ')})`;
					}
				}

				const response = {
					success: true,
					message,
					deletedIngredientsCount,
					deletedIngredientNames,
					...(warning && { warning })
				};

				return NextResponse.json(response);
			}
		} catch (dbError) {
			// Rollback transaction on database error
			await connection.rollback();
			throw dbError;
		} finally {
			// Always release the connection back to the pool
			connection.release();
		}
	} catch (error) {
		const errorCode = (error as any)?.code;
		const errorMessage = error instanceof Error ? error.message : 'Failed to delete recipe';
		let responseCode = 'SERVER_ERROR';
		
		if (errorCode === 'DELETE_FAILED') {
			responseCode = 'DELETE_FAILED';
		} else if (errorCode === 'DATABASE_ERROR' || 
		           errorMessage.includes('Pool exhausted') || 
		           errorMessage.includes('Database constraint violation') ||
		           errorMessage.includes('Connection') ||
		           errorMessage.includes('ECONNREFUSED')) {
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

export const DELETE = withAuth(deleteHandler);
