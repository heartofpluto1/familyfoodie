import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';

interface RecipeRow extends RowDataPacket {
	id: number;
	image_filename: string;
	pdf_filename: string;
}

interface PlanRow extends RowDataPacket {
	count: number;
}

async function deleteHandler(request: NextRequest) {
	try {
		const { recipeId } = await request.json();

		if (!recipeId) {
			return NextResponse.json({ error: 'Recipe ID is required' }, { status: 400 });
		}

		// First, check if the recipe exists and get its filenames
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT id, image_filename, pdf_filename FROM recipes WHERE id = ?', [parseInt(recipeId)]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		const recipe = recipeRows[0];

		// Check if the recipe is used in any planned weeks
		const [planRows] = await pool.execute<PlanRow[]>('SELECT COUNT(*) as count FROM plans WHERE recipe_id = ?', [parseInt(recipeId)]);

		if (planRows[0].count > 0) {
			return NextResponse.json(
				{
					error: 'Cannot delete recipe: it is used in planned weeks. Remove it from all planned weeks first.',
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
						message: 'Cannot delete recipe with existing shopping list history',
						archived: false,
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
					throw new Error('Failed to delete recipe from database');
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

				// Delete associated files after successful database deletion
				const staticDir = path.join(process.cwd(), 'public', 'static');
				const filesToDelete = [recipe.image_filename, recipe.pdf_filename].filter(Boolean);

				for (const filename of filesToDelete) {
					const filePath = path.join(staticDir, filename);
					if (existsSync(filePath)) {
						try {
							await unlink(filePath);
							console.log(`Deleted file: ${filename}`);
						} catch (fileError) {
							console.warn(`Could not delete file: ${filename}`, fileError);
							// Don't fail the entire operation for file deletion errors
						}
					}
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
				});
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
		console.error('Error deleting recipe:', error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to delete recipe',
			},
			{ status: 500 }
		);
	}
}

export const DELETE = withAuth(deleteHandler);
