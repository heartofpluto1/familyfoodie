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
	collectionId: number;
}

interface DatabaseError extends Error {
	code?: string;
	errno?: number;
	sqlMessage?: string;
}

async function updateDetailsHandler(request: AuthenticatedRequest) {
	let body: UpdateRecipeDetailsRequest;

	// Parse and validate JSON
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const { id, name, description, prepTime, cookTime, seasonId, primaryTypeId, secondaryTypeId, collectionId } = body;

	// Validate required fields
	if (id === undefined || id === null || !collectionId) {
		return NextResponse.json({ error: 'Recipe ID, collection ID, and name are required' }, { status: 400 });
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

	// Validate collection ID
	if (typeof collectionId !== 'number' || !Number.isInteger(collectionId) || collectionId <= 0) {
		return NextResponse.json({ error: 'Collection ID must be a positive integer' }, { status: 400 });
	}

	// Validate recipe name
	if (!name || typeof name !== 'string') {
		return NextResponse.json({ error: 'Recipe ID, collection ID, and name are required' }, { status: 400 });
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
		// Validate that the recipe belongs to the collection and household has access
		const isRecipeInCollection = await validateRecipeInCollection(recipeId, collectionId, request.household_id);
		if (!isRecipeInCollection) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		// Check if user owns the recipe
		const canEdit = await canEditResource(request.household_id, 'recipes', recipeId);

		let actualRecipeId = recipeId;
		let actualCollectionId = collectionId;
		let wasCopied = false;
		let newRecipeSlug: string | undefined;
		let newCollectionSlug: string | undefined;
		let actionsTaken: string[] = [];

		// If user doesn't own the recipe, trigger cascade copy with context
		if (!canEdit) {
			const cascadeResult = await cascadeCopyWithContext(request.household_id, collectionId, recipeId);
			actualRecipeId = cascadeResult.newRecipeId;
			actualCollectionId = cascadeResult.newCollectionId;
			actionsTaken = cascadeResult.actionsTaken;
			wasCopied = actionsTaken.includes('recipe_copied') || actionsTaken.includes('collection_copied');
			newRecipeSlug = cascadeResult.newRecipeSlug;
			newCollectionSlug = cascadeResult.newCollectionSlug;
		}

		// Update the recipe details (using the potentially new recipe ID after copy-on-write)
		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE recipes 
			 SET name = ?, description = ?, prepTime = ?, cookTime = ?, season_id = ?, primaryType_id = ?, secondaryType_id = ?, collection_id = ?
			 WHERE id = ?`,
			[trimmedName, safeDescription, safePrepTime, safeCookTime, safeSeasonId, safePrimaryTypeId, safeSecondaryTypeId, actualCollectionId, actualRecipeId]
		);

		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		return NextResponse.json({
			success: true,
			message: 'Recipe details updated successfully',
			...(wasCopied && {
				wasCopied: true,
				newRecipeSlug,
				newCollectionSlug,
			}),
			name: trimmedName,
			description: safeDescription,
			prepTime: safePrepTime,
			cookTime: safeCookTime,
			seasonId: safeSeasonId,
			primaryTypeId: safePrimaryTypeId,
			secondaryTypeId: safeSecondaryTypeId,
		});
	} catch (error: unknown) {
		// Handle foreign key constraint errors
		const dbError = error as DatabaseError;
		if (dbError.code === 'ER_NO_REFERENCED_ROW_2' || dbError.errno === 1452) {
			return NextResponse.json({ error: 'Referenced season, type, or collection does not exist' }, { status: 400 });
		}

		// Handle all other database errors
		return NextResponse.json({ error: 'Failed to update recipe details' }, { status: 500 });
	}
}

export const PUT = withAuth(updateDetailsHandler);
