import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { cascadeCopyWithContext } from '@/lib/copy-on-write';
import { validateRecipeInCollection, canEditResource } from '@/lib/permissions';

interface UpdateRecipeDetailsRequest {
	id: number | string;
	name: string;
	description?: string;
	prepTime?: number | null;
	cookTime?: number | null;
	seasonId?: number | null;
	primaryTypeId?: number | null;
	secondaryTypeId?: number | null;
	currentCollectionId: number;
	newCollectionId: number;
}

interface DatabaseError extends Error {
	code?: string;
	errno?: number;
	sqlMessage?: string;
}

async function updateDetailsHandler(request: AuthenticatedRequest) {
	console.log('[UPDATE-DETAILS] Request received, household_id:', request.household_id);

	let body: UpdateRecipeDetailsRequest;

	// Parse and validate JSON
	try {
		body = await request.json();
		console.log('[UPDATE-DETAILS] Request body:', body);
	} catch (error) {
		console.error('[UPDATE-DETAILS] Failed to parse JSON:', error);
		return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const { id, name, description, prepTime, cookTime, seasonId, primaryTypeId, secondaryTypeId, currentCollectionId, newCollectionId } = body;

	// Validate required fields
	if (id === undefined || id === null || !currentCollectionId || !newCollectionId) {
		return NextResponse.json({ error: 'Recipe ID, current collection ID, and new collection ID are required' }, { status: 400 });
	}

	// Validate and parse recipe ID
	let recipeId: number;
	if (typeof id === 'string') {
		recipeId = parseInt(id, 10);
		if (isNaN(recipeId)) {
			return NextResponse.json({ error: 'Recipe ID must be a valid number' }, { status: 400 });
		}
	} else {
		recipeId = id;
	}

	// Validate collection IDs
	if (typeof currentCollectionId !== 'number' || !Number.isInteger(currentCollectionId) || currentCollectionId <= 0) {
		return NextResponse.json({ error: 'Current collection ID must be a positive integer' }, { status: 400 });
	}
	if (typeof newCollectionId !== 'number' || !Number.isInteger(newCollectionId) || newCollectionId <= 0) {
		return NextResponse.json({ error: 'New collection ID must be a positive integer' }, { status: 400 });
	}

	// Validate recipe name
	if (!name || typeof name !== 'string') {
		return NextResponse.json({ error: 'Recipe name is required' }, { status: 400 });
	}

	const trimmedName = name.trim();
	if (trimmedName === '') {
		return NextResponse.json({ error: 'Recipe name cannot be empty or whitespace only' }, { status: 400 });
	}

	if (trimmedName.length > 64) {
		return NextResponse.json({ error: 'Recipe name must not exceed 64 characters' }, { status: 400 });
	}

	// Validate time fields
	if (prepTime !== undefined && prepTime !== null) {
		if (typeof prepTime !== 'number' || prepTime < 0 || !Number.isInteger(prepTime)) {
			return NextResponse.json({ error: 'Prep and cook times must be positive integers or null' }, { status: 400 });
		}
		if (prepTime > 1440) {
			return NextResponse.json({ error: 'Prep and cook times must not exceed 1440 minutes (24 hours)' }, { status: 400 });
		}
	}

	if (cookTime !== undefined && cookTime !== null) {
		if (typeof cookTime !== 'number' || cookTime < 0 || !Number.isInteger(cookTime)) {
			return NextResponse.json({ error: 'Prep and cook times must be positive integers or null' }, { status: 400 });
		}
		if (cookTime > 1440) {
			return NextResponse.json({ error: 'Prep and cook times must not exceed 1440 minutes (24 hours)' }, { status: 400 });
		}
	}

	// Validate foreign key IDs
	const foreignKeys = [seasonId, primaryTypeId, secondaryTypeId];
	for (const fkId of foreignKeys) {
		if (fkId !== undefined && fkId !== null) {
			if (typeof fkId !== 'number' || fkId <= 0 || !Number.isInteger(fkId)) {
				return NextResponse.json({ error: 'Foreign key IDs must be positive integers' }, { status: 400 });
			}
		}
	}

	// Convert undefined values to null for database, also convert zero times to null for backward compatibility
	const safeDescription = description === undefined ? null : description;
	const safePrepTime = prepTime === undefined || prepTime === 0 ? null : prepTime;
	const safeCookTime = cookTime === undefined || cookTime === 0 ? null : cookTime;
	const safeSeasonId = seasonId === undefined ? null : seasonId;
	const safePrimaryTypeId = primaryTypeId === undefined ? null : primaryTypeId;
	const safeSecondaryTypeId = secondaryTypeId === undefined ? null : secondaryTypeId;

	try {
		console.log('[UPDATE-DETAILS] Starting update for recipe:', {
			recipeId,
			currentCollectionId,
			newCollectionId,
			householdId: request.household_id,
			isMoving: currentCollectionId !== newCollectionId,
		});

		// Validate that the recipe belongs to the current collection and household has access
		console.log('[UPDATE-DETAILS] Validating recipe in current collection...');
		const isRecipeInCollection = await validateRecipeInCollection(recipeId, currentCollectionId, request.household_id);
		if (!isRecipeInCollection) {
			console.log('[UPDATE-DETAILS] Recipe not found in current collection');
			return NextResponse.json({ error: 'Recipe not found in current collection' }, { status: 404 });
		}
		console.log('[UPDATE-DETAILS] Recipe validation passed');

		// Check if user owns the recipe
		console.log('[UPDATE-DETAILS] Checking edit permissions...');
		const canEdit = await canEditResource(request.household_id, 'recipes', recipeId);
		console.log('[UPDATE-DETAILS] Can edit:', canEdit);

		let actualRecipeId = recipeId;
		let actualCollectionId = currentCollectionId;
		let wasCopied = false;
		let newRecipeSlug: string | undefined;
		let newCollectionSlug: string | undefined;
		let actionsTaken: string[] = [];

		// If user doesn't own the recipe, trigger cascade copy with context
		if (!canEdit) {
			console.log('[UPDATE-DETAILS] User does not own recipe, triggering copy-on-write...');
			const cascadeResult = await cascadeCopyWithContext(request.household_id, currentCollectionId, recipeId);
			console.log('[UPDATE-DETAILS] Cascade copy result:', cascadeResult);
			actualRecipeId = cascadeResult.newRecipeId;
			actualCollectionId = cascadeResult.newCollectionId;
			actionsTaken = cascadeResult.actionsTaken;
			wasCopied = actionsTaken.includes('recipe_copied') || actionsTaken.includes('collection_copied');
			newRecipeSlug = cascadeResult.newRecipeSlug;
			newCollectionSlug = cascadeResult.newCollectionSlug;
			console.log('[UPDATE-DETAILS] Will update copied recipe:', { actualRecipeId, actualCollectionId, wasCopied });
		}

		// Update the recipe details (using the potentially new recipe ID after copy-on-write)
		console.log('[UPDATE-DETAILS] Executing UPDATE query with params:', {
			name: trimmedName,
			description: safeDescription,
			prepTime: safePrepTime,
			cookTime: safeCookTime,
			seasonId: safeSeasonId,
			primaryTypeId: safePrimaryTypeId,
			secondaryTypeId: safeSecondaryTypeId,
			recipeId: actualRecipeId,
		});

		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE recipes 
			 SET name = ?, description = ?, prepTime = ?, cookTime = ?, season_id = ?, primaryType_id = ?, secondaryType_id = ?
			 WHERE id = ?`,
			[trimmedName, safeDescription, safePrepTime, safeCookTime, safeSeasonId, safePrimaryTypeId, safeSecondaryTypeId, actualRecipeId]
		);

		console.log('[UPDATE-DETAILS] Update result:', { affectedRows: result.affectedRows });

		if (result.affectedRows === 0) {
			console.log('[UPDATE-DETAILS] No rows affected - recipe not found');
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		// Check if the user requested a collection move (comparing the original request, not actual IDs after copy-on-write)
		const isMovingCollections = currentCollectionId !== newCollectionId;
		let recipeMoved = false;
		let movedToCollectionSlug: string | undefined;

		if (isMovingCollections) {
			console.log('[UPDATE-DETAILS] User requested move from collection', currentCollectionId, 'to', newCollectionId);

			// Only attempt move if user has access to the target collection
			const canAccessNewCollection = await canEditResource(request.household_id, 'collections', newCollectionId);

			if (canAccessNewCollection) {
				console.log('[UPDATE-DETAILS] Moving recipe to new collection...');

				// Remove from current collection (use actualCollectionId in case of copy-on-write)
				// actualCollectionId is where the recipe actually is after potential copy-on-write
				await pool.execute(`DELETE FROM collection_recipes WHERE collection_id = ? AND recipe_id = ?`, [actualCollectionId, actualRecipeId]);

				// Add to new collection (preserve display order as 0 for new additions)
				await pool.execute(`INSERT INTO collection_recipes (collection_id, recipe_id, display_order) VALUES (?, ?, 0)`, [newCollectionId, actualRecipeId]);

				console.log('[UPDATE-DETAILS] Recipe moved successfully to collection:', newCollectionId);
				recipeMoved = true;

				// Get the slug of the new collection
				const [collectionRows] = (await pool.execute('SELECT url_slug FROM collections WHERE id = ?', [newCollectionId])) as [
					Array<{ url_slug: string }>,
					unknown,
				];
				movedToCollectionSlug = collectionRows[0]?.url_slug;
			} else {
				console.log('[UPDATE-DETAILS] Cannot move recipe - household does not have access to target collection, skipping move');
			}
		} else {
			console.log('[UPDATE-DETAILS] No collection move requested (current === new)');
		}

		// Build appropriate message based on what happened
		let message = 'Recipe details updated successfully';
		if (wasCopied && recipeMoved) {
			message = 'Recipe copied, moved to new collection, and details updated successfully';
		} else if (wasCopied) {
			message = 'Recipe copied and details updated successfully';
		} else if (recipeMoved) {
			message = 'Recipe details updated and moved to new collection successfully';
		}

		const response = {
			success: true,
			message,
			...(wasCopied && {
				wasCopied: true,
				newRecipeSlug,
				newCollectionSlug,
			}),
			...(recipeMoved && {
				wasMoved: true,
				newCollectionId,
				newCollectionSlug: movedToCollectionSlug,
			}),
			name: trimmedName,
			description: safeDescription,
			prepTime: safePrepTime,
			cookTime: safeCookTime,
			seasonId: safeSeasonId,
			primaryTypeId: safePrimaryTypeId,
			secondaryTypeId: safeSecondaryTypeId,
		};

		console.log('[UPDATE-DETAILS] Returning success response:', response);
		return NextResponse.json(response);
	} catch (error: unknown) {
		console.error('[UPDATE-DETAILS] Error occurred:', error);
		console.error('[UPDATE-DETAILS] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

		// Handle foreign key constraint errors
		const dbError = error as DatabaseError;
		if (dbError.code === 'ER_NO_REFERENCED_ROW_2' || dbError.errno === 1452) {
			console.log('[UPDATE-DETAILS] Foreign key constraint error');
			return NextResponse.json({ error: 'Referenced season, type, or collection does not exist' }, { status: 400 });
		}

		// Log the actual error message for debugging
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('[UPDATE-DETAILS] Returning 500 with error:', errorMessage);

		// Handle all other database errors
		return NextResponse.json(
			{
				error: 'Failed to update recipe details',
				debug: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
			},
			{ status: 500 }
		);
	}
}

export const PUT = withAuth(updateDetailsHandler);
