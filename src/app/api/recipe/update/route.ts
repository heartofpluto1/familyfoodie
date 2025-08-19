import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';

interface UpdateRecipeRequest {
	id: number;
	name: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	seasonId?: number;
	primaryTypeId?: number;
	secondaryTypeId?: number;
}

async function updateHandler(request: NextRequest) {
	try {
		const body: UpdateRecipeRequest = await request.json();
		const { id, name, description, prepTime, cookTime, seasonId, primaryTypeId, secondaryTypeId } = body;

		// Validate required fields
		if (!id || !name) {
			return NextResponse.json({ error: 'Recipe ID and name are required' }, { status: 400 });
		}

		// Update the recipe
		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE menus_recipe 
			 SET name = ?, description = ?, prepTime = ?, cookTime = ?, season_id = ?, primaryType_id = ?, secondaryType_id = ?
			 WHERE id = ?`,
			[name, description, prepTime || null, cookTime || null, seasonId || null, primaryTypeId || null, secondaryTypeId || null, id]
		);

		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Recipe updated successfully' });
	} catch (error) {
		console.error('Error updating recipe:', error);
		return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 });
	}
}

export const PUT = withAuth(updateHandler);
