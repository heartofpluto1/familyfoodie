import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

interface RecipeRow extends RowDataPacket {
	id: number;
}

interface CollectionRow extends RowDataPacket {
	id: number;
	household_id: number;
}

interface ExistingRecipeRow extends RowDataPacket {
	recipe_id: number;
}

function validateInput(body: { recipeIds?: unknown; targetCollectionId?: unknown }): {
	isValid: boolean;
	error?: { success: false; error: string; code: string };
	recipeIds?: number[];
	targetCollectionId?: number;
} {
	// Validate recipeIds
	if (!body.recipeIds || !Array.isArray(body.recipeIds)) {
		return { isValid: false, error: { success: false, error: 'Recipe IDs must be provided as an array', code: 'INVALID_RECIPE_IDS' } };
	}

	if (body.recipeIds.length === 0) {
		return { isValid: false, error: { success: false, error: 'At least one recipe ID is required', code: 'EMPTY_RECIPE_IDS' } };
	}

	// Validate each recipe ID
	for (const id of body.recipeIds) {
		if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
			return { isValid: false, error: { success: false, error: 'All recipe IDs must be positive integers', code: 'INVALID_RECIPE_ID' } };
		}
	}

	// Validate targetCollectionId
	if (body.targetCollectionId === undefined || body.targetCollectionId === null) {
		return { isValid: false, error: { success: false, error: 'Target collection ID is required', code: 'MISSING_COLLECTION_ID' } };
	}

	const collectionId = Number(body.targetCollectionId);
	if (!Number.isInteger(collectionId) || collectionId <= 0) {
		return { isValid: false, error: { success: false, error: 'Target collection ID must be a positive integer', code: 'INVALID_COLLECTION_ID' } };
	}

	return { isValid: true, recipeIds: body.recipeIds as number[], targetCollectionId: collectionId };
}

async function copyHandler(request: AuthenticatedRequest) {
	let body: { recipeIds?: unknown; targetCollectionId?: unknown };

	// Handle JSON parsing with proper error handling
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ success: false, error: 'Invalid JSON in request body', code: 'INVALID_JSON' }, { status: 400 });
	}

	// Validate input
	const validation = validateInput(body);
	if (!validation.isValid) {
		return NextResponse.json(validation.error, { status: 400 });
	}

	const { recipeIds, targetCollectionId } = validation;

	// TypeScript guard - we know these are defined after successful validation
	if (!recipeIds || !targetCollectionId) {
		return NextResponse.json({ success: false, error: 'Invalid request data', code: 'INVALID_DATA' }, { status: 400 });
	}

	try {
		// Verify target collection exists and belongs to the user's household
		const [collectionRows] = await pool.execute<CollectionRow[]>('SELECT id, household_id FROM collections WHERE id = ? AND household_id = ?', [
			targetCollectionId,
			request.household_id,
		]);

		if (collectionRows.length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Target collection not found or you do not have permission to access it',
					code: 'COLLECTION_NOT_FOUND',
				},
				{ status: 404 }
			);
		}

		// Verify all recipes exist (any household can copy any recipe to their collections)
		const placeholders = recipeIds.map(() => '?').join(',');
		const [recipeRows] = await pool.execute<RecipeRow[]>(`SELECT id FROM recipes WHERE id IN (${placeholders}) AND archived = 0`, recipeIds);

		const foundRecipeIds = recipeRows.map(r => r.id);
		const missingRecipeIds = recipeIds.filter(id => !foundRecipeIds.includes(id));

		if (missingRecipeIds.length > 0) {
			return NextResponse.json(
				{
					success: false,
					error: `Some recipes were not found: ${missingRecipeIds.join(', ')}`,
					code: 'RECIPES_NOT_FOUND',
					missingIds: missingRecipeIds,
				},
				{ status: 404 }
			);
		}

		// Check which recipes already exist in the target collection
		const [existingRows] = await pool.execute<ExistingRecipeRow[]>(
			`SELECT recipe_id FROM collection_recipes WHERE collection_id = ? AND recipe_id IN (${placeholders})`,
			[targetCollectionId, ...recipeIds]
		);

		const existingRecipeIds = new Set(existingRows.map(r => r.recipe_id));
		const recipesToCopy = recipeIds.filter(id => !existingRecipeIds.has(id));

		if (recipesToCopy.length === 0) {
			return NextResponse.json({
				success: true,
				message: 'All selected recipes already exist in the target collection',
				copiedCount: 0,
				skippedCount: recipeIds.length,
			});
		}

		// Copy recipes to the target collection
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();

			// Insert recipes into collection_recipes
			const values = recipesToCopy.map(recipeId => [targetCollectionId, recipeId]);
			const insertPlaceholders = values.map(() => '(?, ?)').join(',');
			const flatValues = values.flat();

			const [insertResult] = await connection.execute<ResultSetHeader>(
				`INSERT INTO collection_recipes (collection_id, recipe_id) VALUES ${insertPlaceholders}`,
				flatValues
			);

			if (insertResult.affectedRows !== recipesToCopy.length) {
				throw new Error('Failed to copy all recipes to the collection');
			}

			await connection.commit();

			return NextResponse.json({
				success: true,
				message: `Successfully copied ${recipesToCopy.length} recipe${recipesToCopy.length !== 1 ? 's' : ''} to the collection`,
				copiedCount: recipesToCopy.length,
				skippedCount: existingRecipeIds.size,
				copiedRecipeIds: recipesToCopy,
				skippedRecipeIds: Array.from(existingRecipeIds),
			});
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Failed to copy recipes';
		let responseCode = 'SERVER_ERROR';

		if (errorMessage.includes('Duplicate entry')) {
			responseCode = 'DUPLICATE_ENTRY';
		} else if (errorMessage.includes('foreign key constraint')) {
			responseCode = 'CONSTRAINT_VIOLATION';
		} else if (errorMessage.includes('Connection') || errorMessage.includes('ECONNREFUSED')) {
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

export const POST = withAuth(copyHandler);
