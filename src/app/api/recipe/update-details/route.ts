import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';

interface UpdateRecipeDetailsRequest {
	id: number;
	name: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	seasonId?: number;
	primaryTypeId?: number;
	secondaryTypeId?: number;
	collectionId?: number;
}

async function updateDetailsHandler(request: NextRequest) {
	try {
		const body: UpdateRecipeDetailsRequest = await request.json();
		const { id, name, description, prepTime, cookTime, seasonId, primaryTypeId, secondaryTypeId, collectionId } = body;

		// Validate required fields
		if (!id || !name) {
			return NextResponse.json({ error: 'Recipe ID and name are required' }, { status: 400 });
		}

		// Update only the recipe details
		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE recipes 
			 SET name = ?, description = ?, prepTime = ?, cookTime = ?, season_id = ?, primaryType_id = ?, secondaryType_id = ?, collection_id = ?
			 WHERE id = ?`,
			[name, description, prepTime || null, cookTime || null, seasonId || null, primaryTypeId || null, secondaryTypeId || null, collectionId || null, id]
		);

		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Recipe details updated successfully' });
	} catch {
		return NextResponse.json({ error: 'Failed to update recipe details' }, { status: 500 });
	}
}

export const PUT = withAuth(updateDetailsHandler);
