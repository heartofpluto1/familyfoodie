import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { triggerCascadeCopyIfNeeded } from '@/lib/copy-on-write';

interface UpdateRecipeDetailsRequest {
	id: number | string;
	name: string;
	description?: string;
	prepTime?: number | null;
	cookTime?: number | null;
	seasonId?: number | null;
	primaryTypeId?: number | null;
	secondaryTypeId?: number | null;
	collectionId?: number | null;
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

	// Validate and parse recipe ID
	let recipeId: number;
	if (id === undefined || id === null) {
		return NextResponse.json({ error: 'Recipe ID and name are required' }, { status: 400 });
	}

	if (typeof id === 'string') {
		recipeId = parseInt(id, 10);
		if (isNaN(recipeId)) {
			return NextResponse.json({ error: 'Recipe ID must be a valid number' }, { status: 400 });
		}
	} else {
		recipeId = id;
	}

	// Validate recipe name
	if (!name || typeof name !== 'string') {
		return NextResponse.json({ error: 'Recipe ID and name are required' }, { status: 400 });
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
	const foreignKeys = [seasonId, primaryTypeId, secondaryTypeId, collectionId];
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
	const safeCollectionId = collectionId === undefined ? null : collectionId;

	try {
		// Trigger cascade copy if needed (copy-on-write for non-owned recipes)
		const actualRecipeId = await triggerCascadeCopyIfNeeded(request.household_id, recipeId);

		// Update the recipe details (using the potentially new recipe ID after copy-on-write)
		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE recipes 
			 SET name = ?, description = ?, prepTime = ?, cookTime = ?, season_id = ?, primaryType_id = ?, secondaryType_id = ?, collection_id = ?
			 WHERE id = ?`,
			[trimmedName, safeDescription, safePrepTime, safeCookTime, safeSeasonId, safePrimaryTypeId, safeSecondaryTypeId, safeCollectionId, actualRecipeId]
		);

		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		return NextResponse.json({
			success: true,
			message: 'Recipe details updated successfully',
			...(actualRecipeId !== recipeId && { newRecipeId: actualRecipeId, copied: true }),
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
