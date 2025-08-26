import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuthHousehold, AuthenticatedRequest } from '@/lib/auth-middleware';
import { cleanupRecipeFiles } from '@/lib/utils/secureFilename.server';
import { canEditResource } from '@/lib/permissions';
import { performCompleteCleanupAfterRecipeDelete } from '@/lib/copy-on-write';

interface RecipeRow extends RowDataPacket {
	id: number;
	image_filename: string;
	pdf_filename: string;
}

interface PlanRow extends RowDataPacket {
	count: number;
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

async function deleteHandler(request: AuthenticatedRequest, context?: unknown) {
	let recipeId: unknown;

	// Handle JSON parsing with proper error handling
	try {
		const body = await request.json();
		recipeId = body.recipeId;
	} catch {
		return NextResponse.json({ success: false, error: 'Invalid JSON in request body', code: 'INVALID_JSON' }, { status: 400 });
	}

	// Validate recipe ID
	const validation = validateRecipeId(recipeId);
	if (!validation.isValid) {
		return NextResponse.json(validation.error, { status: 400 });
	}

	const numericRecipeId = parseInt(recipeId as string);

	try {
		// Check if user can edit this recipe (household ownership)
		const canEdit = await canEditResource(request.household_id, 'recipes', numericRecipeId);
		if (!canEdit) {
			return NextResponse.json(
				{
					success: false,
					error: 'You can only delete recipes owned by your household',
					code: 'PERMISSION_DENIED',
				},
				{ status: 403 }
			);
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
			request.household_id,
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
			[numericRecipeId, request.household_id]
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
					[numericRecipeId, request.household_id]
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
			// No shopping list history - safe to fully delete
			try {
				// Use the new cleanup system that handles household isolation
				const cleanupResult = await performCompleteCleanupAfterRecipeDelete(numericRecipeId, request.household_id);

				// Delete the recipe itself
				const [deleteResult] = await pool.execute<ResultSetHeader>('DELETE FROM recipes WHERE id = ?', [numericRecipeId]);

				if (deleteResult.affectedRows === 0) {
					throw new Error('Failed to delete recipe from database');
				}

				// Delete associated files after successful database deletion
				let warning: string | undefined;
				try {
					await cleanupRecipeFiles(recipe.image_filename, recipe.pdf_filename);
				} catch (cleanupError) {
					warning = `File cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`;
				}

				let message = 'Recipe deleted successfully';
				if (cleanupResult.deletedOrphanedIngredients.length > 0) {
					message += ` and cleaned up ${cleanupResult.deletedOrphanedIngredients.length} unused household ingredient${
						cleanupResult.deletedOrphanedIngredients.length === 1 ? '' : 's'
					}`;
				}

				return NextResponse.json({
					success: true,
					message,
					deletedIngredientsCount: cleanupResult.deletedOrphanedIngredients.length,
					deletedRecipeIngredients: cleanupResult.deletedRecipeIngredients,
					...(warning && { warning }),
				});
			} catch (error) {
				throw error;
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

export const DELETE = withAuthHousehold(deleteHandler);
