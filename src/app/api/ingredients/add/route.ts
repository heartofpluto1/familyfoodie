import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { RowDataPacket } from 'mysql2';

interface AddIngredientRequest {
	name: string;
	fresh: boolean;
	price: number | null;
	stockcode: number | null;
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

interface ValidationError {
	field: string;
	code: string;
	message: string;
	value?: unknown;
	maxLength?: number;
	actualLength?: number;
}

interface ApiErrorResponse {
	success: false;
	error: string;
	code?: string;
	details?: ValidationError[] | { field?: string; value?: unknown; existingId?: number };
}

interface ApiSuccessResponse {
	success: true;
	data: {
		id: number;
		name: string;
		fresh: boolean;
		price: number | null;
		stockcode: number | null;
		supermarketCategoryId: number | null;
		pantryCategoryId: number | null;
		household_id: number;
		created_at: string;
	};
	message: string;
}

function validateIngredientData(data: unknown): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!data || typeof data !== 'object') {
		errors.push({
			field: 'body',
			code: 'INVALID_TYPE',
			message: 'Request body must be a valid object',
			value: data,
		});
		return errors;
	}

	const ingredient = data as Record<string, unknown>;

	// Validate name (required string)
	if (!ingredient.name) {
		errors.push({
			field: 'name',
			code: 'REQUIRED',
			message: 'Ingredient name is required',
		});
	} else if (typeof ingredient.name !== 'string') {
		errors.push({
			field: 'name',
			code: 'INVALID_TYPE',
			message: 'Name must be a string',
			value: ingredient.name,
		});
	} else {
		const trimmedName = ingredient.name.trim();
		if (!trimmedName) {
			errors.push({
				field: 'name',
				code: 'REQUIRED',
				message: 'Ingredient name cannot be empty',
			});
		} else if (trimmedName.length > 255) {
			errors.push({
				field: 'name',
				code: 'MAX_LENGTH_EXCEEDED',
				message: 'Ingredient name cannot exceed 255 characters',
				maxLength: 255,
				actualLength: trimmedName.length,
			});
		}
	}

	// Validate fresh (required boolean)
	if (ingredient.fresh === undefined || ingredient.fresh === null) {
		errors.push({
			field: 'fresh',
			code: 'REQUIRED',
			message: 'Fresh status is required',
		});
	} else if (typeof ingredient.fresh !== 'boolean') {
		errors.push({
			field: 'fresh',
			code: 'INVALID_TYPE',
			message: 'Fresh must be a boolean',
			value: ingredient.fresh,
		});
	}

	// Validate price (optional number, must be positive if provided)
	if (ingredient.price !== null && ingredient.price !== undefined) {
		if (typeof ingredient.price !== 'number') {
			errors.push({
				field: 'price',
				code: 'INVALID_TYPE',
				message: 'Price must be a number or null',
				value: ingredient.price,
			});
		} else if (ingredient.price < 0) {
			errors.push({
				field: 'price',
				code: 'OUT_OF_RANGE',
				message: 'Price must be greater than or equal to 0',
				value: ingredient.price,
			});
		}
	}

	// Validate stockcode (optional number)
	if (ingredient.stockcode !== null && ingredient.stockcode !== undefined) {
		if (typeof ingredient.stockcode !== 'number' || !Number.isInteger(ingredient.stockcode)) {
			errors.push({
				field: 'stockcode',
				code: 'INVALID_TYPE',
				message: 'Stockcode must be an integer or null',
				value: ingredient.stockcode,
			});
		}
	}

	// Validate supermarketCategoryId (optional positive integer)
	if (ingredient.supermarketCategoryId !== null && ingredient.supermarketCategoryId !== undefined) {
		if (typeof ingredient.supermarketCategoryId !== 'number' || !Number.isInteger(ingredient.supermarketCategoryId)) {
			errors.push({
				field: 'supermarketCategoryId',
				code: 'INVALID_TYPE',
				message: 'Supermarket category ID must be an integer or null',
				value: ingredient.supermarketCategoryId,
			});
		} else if (ingredient.supermarketCategoryId <= 0) {
			errors.push({
				field: 'supermarketCategoryId',
				code: 'OUT_OF_RANGE',
				message: 'Supermarket category ID must be greater than 0',
				value: ingredient.supermarketCategoryId,
			});
		}
	}

	// Validate pantryCategoryId (optional positive integer)
	if (ingredient.pantryCategoryId !== null && ingredient.pantryCategoryId !== undefined) {
		if (typeof ingredient.pantryCategoryId !== 'number' || !Number.isInteger(ingredient.pantryCategoryId)) {
			errors.push({
				field: 'pantryCategoryId',
				code: 'INVALID_TYPE',
				message: 'Pantry category ID must be an integer or null',
				value: ingredient.pantryCategoryId,
			});
		} else if (ingredient.pantryCategoryId <= 0) {
			errors.push({
				field: 'pantryCategoryId',
				code: 'OUT_OF_RANGE',
				message: 'Pantry category ID must be greater than 0',
				value: ingredient.pantryCategoryId,
			});
		}
	}

	return errors;
}

async function addIngredientHandler(request: AuthenticatedRequest): Promise<NextResponse<ApiSuccessResponse | ApiErrorResponse>> {
	try {
		// Parse request body
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			const errorResponse: ApiErrorResponse = {
				success: false,
				error: 'Invalid JSON in request body',
				code: 'INVALID_JSON',
			};
			return NextResponse.json(errorResponse, { status: 400 });
		}

		// Validate input data
		const validationErrors = validateIngredientData(body);
		if (validationErrors.length > 0) {
			const errorResponse: ApiErrorResponse = {
				success: false,
				error: validationErrors.length === 1 ? validationErrors[0].message : 'Invalid input data',
				code: 'VALIDATION_ERROR',
				details: validationErrors,
			};
			return NextResponse.json(errorResponse, { status: 400 });
		}

		// Now we know the data is valid
		const ingredientData = body as AddIngredientRequest;
		const { name, fresh, price, stockcode, supermarketCategoryId, pantryCategoryId } = ingredientData;
		const trimmedName = name.trim();

		// Check if ingredient already exists in household
		const [existingRows] = await pool.execute<RowDataPacket[]>('SELECT id FROM ingredients WHERE name = ? AND household_id = ?', [
			trimmedName,
			request.household_id,
		]);

		if (existingRows.length > 0) {
			const errorResponse: ApiErrorResponse = {
				success: false,
				error: 'An ingredient with this name already exists in your household',
				code: 'DUPLICATE_RESOURCE',
				details: {
					field: 'name',
					value: trimmedName,
					existingId: existingRows[0].id,
				},
			};
			return NextResponse.json(errorResponse, { status: 409 });
		}

		// Add the new ingredient with household ownership
		const [result] = await pool.execute(
			`INSERT INTO ingredients 
			 (name, fresh, cost, stockcode, supermarketCategory_id, pantryCategory_id, public, household_id) 
			 VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
			[trimmedName, fresh, price, stockcode, supermarketCategoryId, pantryCategoryId, request.household_id]
		);

		const insertResult = result as { insertId: number };

		// Fetch the created ingredient with all details
		const [createdRows] = await pool.execute<RowDataPacket[]>(
			`SELECT id, name, fresh, cost as price, stockcode, 
			        supermarketCategory_id as supermarketCategoryId, 
			        pantryCategory_id as pantryCategoryId, 
			        household_id, created_at 
			 FROM ingredients 
			 WHERE id = ?`,
			[insertResult.insertId]
		);

		const createdIngredient = createdRows[0];

		const successResponse: ApiSuccessResponse = {
			success: true,
			data: {
				id: createdIngredient.id,
				name: createdIngredient.name,
				fresh: Boolean(createdIngredient.fresh),
				price: createdIngredient.price,
				stockcode: createdIngredient.stockcode,
				supermarketCategoryId: createdIngredient.supermarketCategoryId,
				pantryCategoryId: createdIngredient.pantryCategoryId,
				household_id: createdIngredient.household_id,
				created_at: createdIngredient.created_at,
			},
			message: 'Ingredient added successfully',
		};

		const response = NextResponse.json(successResponse, { status: 201 });
		response.headers.set('Location', `/api/ingredients/${insertResult.insertId}`);

		return response;
	} catch (error) {
		// Sanitize error messages for security
		const errorResponse: ApiErrorResponse = {
			success: false,
			error: 'An internal server error occurred. Please try again later.',
			code: 'INTERNAL_ERROR',
		};

		// In development, you might want to log the actual error
		if (process.env.NODE_ENV === 'development') {
			console.error('Internal error in addIngredientHandler:', error);
		}

		return NextResponse.json(errorResponse, { status: 500 });
	}
}

export const POST = withAuth(addIngredientHandler);
