import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';

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

interface UpdateIngredientRequest {
	id: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
}

interface AddIngredientRequest {
	recipeId: number;
	ingredientId: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
	preparationId?: number;
}

async function putHandler(request: NextRequest) {
	try {
		const body: UpdateIngredientRequest = await request.json();
		const { id, quantity, quantity4, measureId } = body;

		// Validate required fields
		if (!id || !quantity || !quantity4) {
			return createErrorResponse('Ingredient ID and quantities are required', 'VALIDATION_ERROR', 400);
		}

		// Validate ID type
		if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
			return createErrorResponse('Invalid ingredient ID format', 'VALIDATION_ERROR', 400);
		}

		// Validate quantities are not empty strings
		if (quantity.trim() === '' || quantity4.trim() === '') {
			return createErrorResponse('Ingredient ID and quantities are required', 'VALIDATION_ERROR', 400);
		}

		// Update the recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE recipe_ingredients 
			 SET quantity = ?, quantity4 = ?, quantityMeasure_id = ?
			 WHERE id = ?`,
			[quantity, quantity4, measureId || null, id]
		);

		if (result.affectedRows === 0) {
			return createErrorResponse('Recipe ingredient not found', 'INGREDIENT_NOT_FOUND', 404);
		}

		return NextResponse.json({
			success: true,
			message: 'Ingredient updated successfully',
			data: {
				id,
				quantity,
				quantity4,
				measureId,
			},
		});
	} catch (error) {
		console.error('Error updating recipe ingredient:', error);
		return createErrorResponse('Failed to update recipe ingredient', 'SERVER_ERROR', 500);
	}
}

async function postHandler(request: NextRequest) {
	try {
		const body: AddIngredientRequest = await request.json();
		const { recipeId, ingredientId, quantity, quantity4, measureId, preparationId } = body;

		// Validate required fields exist
		if (!recipeId || !ingredientId || quantity == null || quantity4 == null) {
			return createErrorResponse('Recipe ID, ingredient ID, and quantities are required', 'VALIDATION_ERROR', 400);
		}

		// Validate quantities are not empty strings
		if ((typeof quantity === 'string' && quantity.trim() === '') || (typeof quantity4 === 'string' && quantity4.trim() === '')) {
			return createErrorResponse('Quantity cannot be empty', 'VALIDATION_ERROR', 400);
		}

		// Add the new recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(
			`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, quantity4, quantityMeasure_id, preperation_id, primaryIngredient)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[recipeId, ingredientId, quantity, quantity4, measureId || null, preparationId || null, 0]
		);

		return NextResponse.json({
			success: true,
			message: 'Ingredient added successfully',
			data: {
				id: result.insertId,
				recipeId,
				ingredientId,
				quantity,
				quantity4,
				measureId,
				preparationId,
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

async function deleteHandler(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return createErrorResponse('Ingredient ID is required', 'VALIDATION_ERROR', 400);
		}

		// Validate ID format (must be numeric)
		if (!/^\d+$/.test(id)) {
			return createErrorResponse('Invalid ingredient ID format', 'VALIDATION_ERROR', 400);
		}

		// Delete the recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM recipe_ingredients WHERE id = ?`, [parseInt(id)]);

		if (result.affectedRows === 0) {
			return createErrorResponse('Recipe ingredient not found', 'INGREDIENT_NOT_FOUND', 404);
		}

		return NextResponse.json({
			success: true,
			message: 'Ingredient removed successfully',
			data: {
				deletedId: parseInt(id),
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
