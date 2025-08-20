import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth } from '@/lib/auth-middleware';

interface UpdateIngredientRequest {
	id: number;
	name: string;
	fresh: boolean;
	price: number | null;
	stockcode: number | null;
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

async function updateIngredientHandler(request: NextRequest) {
	try {
		const body: UpdateIngredientRequest = await request.json();
		const { id, name, fresh, price, stockcode, supermarketCategoryId, pantryCategoryId } = body;

		// Validate required fields
		if (!id || !name) {
			return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
		}

		// Update the ingredient
		await pool.execute(
			`UPDATE ingredients 
			 SET name = ?, fresh = ?, cost = ?, stockcode = ?, 
			     supermarketCategory_id = ?, pantryCategory_id = ?
			 WHERE id = ? AND public = 1`,
			[name, fresh, price, stockcode, supermarketCategoryId, pantryCategoryId, id]
		);

		return NextResponse.json({ success: true, message: 'Ingredient updated successfully' });
	} catch (error) {
		console.error('Error updating ingredient:', error);
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update ingredient' }, { status: 500 });
	}
}

export const PUT = withAuth(updateIngredientHandler);
