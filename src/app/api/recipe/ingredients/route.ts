import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { cascadeCopyWithContext, cascadeCopyIngredientWithContext, copyIngredientForEdit } from '@/lib/copy-on-write';
import { validateRecipeInCollection, validateHouseholdCollectionAccess } from '@/lib/permissions';

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

// Helper function to check if user can edit a recipe
async function canEditRecipe(recipeId: number, householdId: number): Promise<boolean> {
	const [rows] = await pool.execute<RowDataPacket[]>('SELECT household_id FROM recipes WHERE id = ?', [recipeId]);
	return rows.length > 0 && rows[0].household_id === householdId;
}

// Helper function to check if user can edit an ingredient
async function canEditIngredient(ingredientId: number, householdId: number): Promise<boolean> {
	const [rows] = await pool.execute<RowDataPacket[]>('SELECT household_id FROM ingredients WHERE id = ?', [ingredientId]);
	return rows.length > 0 && rows[0].household_id === householdId;
}

// Helper function to get recipe and ingredient info from recipe_ingredient
async function getRecipeIngredientInfo(recipeIngredientId: number): Promise<{
	recipeId: number;
	ingredientId: number;
} | null> {
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT recipe_id, ingredient_id
		 FROM recipe_ingredients
		 WHERE id = ?`,
		[recipeIngredientId]
	);

	if (rows.length === 0) return null;

	return {
		recipeId: rows[0].recipe_id,
		ingredientId: rows[0].ingredient_id,
	};
}

interface UpdateIngredientRequest {
	id: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
	collectionId: number; // Required: needed for cascade copy context
}

interface AddIngredientRequest {
	recipeId: number;
	ingredientId: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
	preparationId?: number;
	collectionId: number; // Required: needed for cascade copy context
}

async function putHandler(request: AuthenticatedRequest) {
	try {
		const body: UpdateIngredientRequest = await request.json();
		const { id, quantity, quantity4, measureId, collectionId } = body;

		// Validate required fields
		if (!id || !quantity || !quantity4 || !collectionId) {
			return createErrorResponse('Ingredient ID, quantities, and collection ID are required', 'VALIDATION_ERROR', 400);
		}

		// Validate ID types
		if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
			return createErrorResponse('Invalid ingredient ID format', 'VALIDATION_ERROR', 400);
		}
		if (typeof collectionId !== 'number' || !Number.isInteger(collectionId) || collectionId <= 0) {
			return createErrorResponse('Invalid collection ID format', 'VALIDATION_ERROR', 400);
		}

		// Validate quantities are not empty strings
		if (quantity.trim() === '' || quantity4.trim() === '') {
			return createErrorResponse('Quantities cannot be empty', 'VALIDATION_ERROR', 400);
		}

		// Get the recipe and ingredient IDs
		const recipeIngredientInfo = await getRecipeIngredientInfo(id);
		if (!recipeIngredientInfo) {
			return createErrorResponse('Recipe ingredient not found', 'INGREDIENT_NOT_FOUND', 404);
		}

		// Validate that the recipe belongs to the specified collection and household has access
		const isRecipeInCollection = await validateRecipeInCollection(recipeIngredientInfo.recipeId, collectionId, request.household_id);
		if (!isRecipeInCollection) {
			return createErrorResponse('Recipe not found', 'RECIPE_NOT_FOUND', 404);
		}

		// Check if the user owns the recipe
		const canEdit = await canEditRecipe(recipeIngredientInfo.recipeId, request.household_id);

		let targetRecipeIngredientId = id;
		let newRecipeId: number | undefined;
		let newIngredientId: number | undefined;
		let actionsTaken: string[] = [];

		// If user doesn't own the recipe, trigger cascade copy with context
		if (!canEdit) {
			// Use the full cascade copy with collection context
			const cascadeResult = await cascadeCopyIngredientWithContext(
				request.household_id,
				collectionId,
				recipeIngredientInfo.recipeId,
				recipeIngredientInfo.ingredientId
			);

			newRecipeId = cascadeResult.newRecipeId;
			newIngredientId = cascadeResult.newIngredientId;
			actionsTaken = cascadeResult.actionsTaken;

			// Find the new recipe_ingredient ID in the copied recipe
			const [newRecipeIngredient] = await pool.execute<RowDataPacket[]>('SELECT id FROM recipe_ingredients WHERE recipe_id = ? AND ingredient_id = ?', [
				cascadeResult.newRecipeId,
				cascadeResult.newIngredientId,
			]);

			if (newRecipeIngredient.length === 0) {
				return createErrorResponse('Failed to find ingredient in copied recipe', 'COPY_ERROR', 500);
			}

			targetRecipeIngredientId = newRecipeIngredient[0].id;
		}

		// Update the recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE recipe_ingredients 
			 SET quantity = ?, quantity4 = ?, quantityMeasure_id = ?
			 WHERE id = ?`,
			[quantity, quantity4, measureId || null, targetRecipeIngredientId]
		);

		if (result.affectedRows === 0) {
			return createErrorResponse('Recipe ingredient not found', 'INGREDIENT_NOT_FOUND', 404);
		}

		return NextResponse.json({
			success: true,
			message: 'Ingredient updated successfully',
			data: {
				id: targetRecipeIngredientId,
				quantity,
				quantity4,
				measureId,
				newRecipeId,
				newIngredientId,
				actionsTaken,
				redirectNeeded: actionsTaken.length > 0,
			},
		});
	} catch (error) {
		console.error('Error updating recipe ingredient:', error);
		return createErrorResponse('Failed to update recipe ingredient', 'SERVER_ERROR', 500);
	}
}

async function postHandler(request: AuthenticatedRequest) {
	try {
		const body: AddIngredientRequest = await request.json();
		const { recipeId, ingredientId, quantity, quantity4, measureId, preparationId, collectionId } = body;

		// Validate required fields exist
		if (!recipeId || !ingredientId || quantity == null || quantity4 == null || !collectionId) {
			return createErrorResponse('Recipe ID, ingredient ID, quantities, and collection ID are required', 'VALIDATION_ERROR', 400);
		}

		// Validate ID types
		if (typeof collectionId !== 'number' || !Number.isInteger(collectionId) || collectionId <= 0) {
			return createErrorResponse('Invalid collection ID format', 'VALIDATION_ERROR', 400);
		}

		// Validate quantities are not empty strings
		if ((typeof quantity === 'string' && quantity.trim() === '') || (typeof quantity4 === 'string' && quantity4.trim() === '')) {
			return createErrorResponse('Quantity cannot be empty', 'VALIDATION_ERROR', 400);
		}

		// Validate that the recipe belongs to the specified collection and household has access
		const isRecipeInCollection = await validateRecipeInCollection(recipeId, collectionId, request.household_id);
		if (!isRecipeInCollection) {
			return createErrorResponse('Recipe not found', 'RECIPE_NOT_FOUND', 404);
		}

		// Check if the user owns the recipe
		const canEdit = await canEditRecipe(recipeId, request.household_id);

		let targetRecipeId = recipeId;
		let targetIngredientId = ingredientId;
		let actionsTaken: string[] = [];

		// If user doesn't own the recipe, use cascade copy with context
		if (!canEdit) {
			// Use full cascade copy with collection context
			const cascadeResult = await cascadeCopyIngredientWithContext(request.household_id, collectionId, recipeId, ingredientId);

			targetRecipeId = cascadeResult.newRecipeId;
			targetIngredientId = cascadeResult.newIngredientId;
			actionsTaken = cascadeResult.actionsTaken;
		} else {
			// User owns the recipe, but check if ingredient needs copying
			const canEditIngredientFlag = await canEditIngredient(ingredientId, request.household_id);
			if (!canEditIngredientFlag) {
				const ingredientCopyResult = await copyIngredientForEdit(ingredientId, request.household_id);
				targetIngredientId = ingredientCopyResult.newId;
				if (ingredientCopyResult.copied) {
					actionsTaken.push('ingredient_copied');
				}
			}
		}

		// Add the new recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(
			`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, quantity4, quantityMeasure_id, preperation_id, primaryIngredient)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[targetRecipeId, targetIngredientId, quantity, quantity4, measureId || null, preparationId || null, 0]
		);

		return NextResponse.json({
			success: true,
			message: 'Ingredient added successfully',
			data: {
				id: result.insertId,
				recipeId: targetRecipeId,
				ingredientId: targetIngredientId,
				quantity,
				quantity4,
				measureId,
				preparationId,
				actionsTaken,
				redirectNeeded: actionsTaken.includes('recipe_copied') || actionsTaken.includes('collection_copied'),
			},
		});
	} catch (error) {
		console.error('Error adding recipe ingredient:', error);

		// Handle database constraint violations
		const errorMessage = error instanceof Error ? error.message : '';

		if (errorMessage.includes('FOREIGN KEY constraint failed') || errorMessage.includes('FOREIGN KEY')) {
			if (errorMessage.includes('recipe_id') || errorMessage.toLowerCase().includes('recipe')) {
				return createErrorResponse('Recipe not found', 'INVALID_RECIPE_ID', 400);
			}
			if (errorMessage.includes('ingredient_id') || errorMessage.toLowerCase().includes('ingredient')) {
				return createErrorResponse('Ingredient not found', 'INVALID_INGREDIENT_ID', 400);
			}
			// Generic foreign key error
			return createErrorResponse('Recipe not found', 'INVALID_RECIPE_ID', 400);
		}

		if (errorMessage.includes('UNIQUE constraint failed') || errorMessage.includes('UNIQUE')) {
			return createErrorResponse('Ingredient already exists in this recipe', 'DUPLICATE_INGREDIENT', 409);
		}

		return createErrorResponse('Failed to add recipe ingredient', 'SERVER_ERROR', 500);
	}
}

async function deleteHandler(request: AuthenticatedRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');
		const collectionId = searchParams.get('collectionId');

		if (!id || !collectionId) {
			return createErrorResponse('Ingredient ID and collection ID are required', 'VALIDATION_ERROR', 400);
		}

		// Validate ID formats (must be numeric)
		if (!/^\d+$/.test(id)) {
			return createErrorResponse('Invalid ingredient ID format', 'VALIDATION_ERROR', 400);
		}
		if (!/^\d+$/.test(collectionId)) {
			return createErrorResponse('Invalid collection ID format', 'VALIDATION_ERROR', 400);
		}

		const recipeIngredientId = parseInt(id);
		const collectionIdNum = parseInt(collectionId);

		// Get the recipe and ingredient info
		const recipeIngredientInfo = await getRecipeIngredientInfo(recipeIngredientId);
		if (!recipeIngredientInfo) {
			return createErrorResponse('Recipe ingredient not found', 'INGREDIENT_NOT_FOUND', 404);
		}

		// Validate that the recipe belongs to the specified collection and household has access
		const isRecipeInCollection = await validateRecipeInCollection(recipeIngredientInfo.recipeId, collectionIdNum, request.household_id);
		if (!isRecipeInCollection) {
			return createErrorResponse('Recipe not found', 'RECIPE_NOT_FOUND', 404);
		}

		// Check if the user owns the recipe
		const canEdit = await canEditRecipe(recipeIngredientInfo.recipeId, request.household_id);

		let targetRecipeIngredientId = recipeIngredientId;
		let newRecipeId: number | undefined;
		let actionsTaken: string[] = [];

		// Handle copy-on-write if user doesn't own the recipe
		if (!canEdit) {
			// Use cascade copy with collection context
			const cascadeResult = await cascadeCopyWithContext(request.household_id, collectionIdNum, recipeIngredientInfo.recipeId);

			newRecipeId = cascadeResult.newRecipeId;
			actionsTaken = cascadeResult.actionsTaken;

			// Find the corresponding recipe_ingredient ID in the copied recipe
			const [copiedRecipeIngredient] = await pool.execute<RowDataPacket[]>(
				`SELECT ri_new.id 
				 FROM recipe_ingredients ri_original
				 JOIN recipe_ingredients ri_new ON ri_new.ingredient_id = ri_original.ingredient_id 
				 WHERE ri_original.id = ? AND ri_new.recipe_id = ?`,
				[recipeIngredientId, cascadeResult.newRecipeId]
			);

			if (copiedRecipeIngredient.length === 0) {
				return createErrorResponse('Failed to find ingredient in copied recipe', 'COPY_ERROR', 500);
			}

			targetRecipeIngredientId = copiedRecipeIngredient[0].id;
		}

		// Delete the recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM recipe_ingredients WHERE id = ?`, [targetRecipeIngredientId]);

		if (result.affectedRows === 0) {
			return createErrorResponse('Recipe ingredient not found', 'INGREDIENT_NOT_FOUND', 404);
		}

		return NextResponse.json({
			success: true,
			message: 'Ingredient removed successfully',
			data: {
				deletedId: targetRecipeIngredientId,
				newRecipeId,
				actionsTaken,
				redirectNeeded: actionsTaken.includes('recipe_copied') || actionsTaken.includes('collection_copied'),
			},
		});
	} catch (error) {
		console.error('Error removing recipe ingredient:', error);
		return createErrorResponse('Failed to remove recipe ingredient', 'SERVER_ERROR', 500);
	}
}

export const PUT = withAuth(putHandler);
export const POST = withAuth(postHandler);
export const DELETE = withAuth(deleteHandler);
