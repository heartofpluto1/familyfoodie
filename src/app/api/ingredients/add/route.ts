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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function addIngredientHandler(request: AuthenticatedRequest, context?: unknown) {
	try {
		const body: AddIngredientRequest = await request.json();
		const { name, fresh, price, stockcode, supermarketCategoryId, pantryCategoryId } = body;

		// Validate required fields
		if (!name || !name.trim()) {
			return NextResponse.json({ error: 'Ingredient name is required' }, { status: 400 });
		}

		// Check if ingredient already exists in household
		const [existingRows] = await pool.execute<RowDataPacket[]>('SELECT id FROM ingredients WHERE name = ? AND household_id = ?', [
			name.trim(),
			request.household_id,
		]);

		if (existingRows.length > 0) {
			return NextResponse.json({ error: 'An ingredient with this name already exists in your household' }, { status: 400 });
		}

		// Add the new ingredient with household ownership
		const [result] = await pool.execute(
			`INSERT INTO ingredients 
			 (name, fresh, cost, stockcode, supermarketCategory_id, pantryCategory_id, public, household_id) 
			 VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
			[name.trim(), fresh, price, stockcode, supermarketCategoryId, pantryCategoryId, request.household_id]
		);

		const insertResult = result as { insertId: number };

		return NextResponse.json({
			success: true,
			message: 'Ingredient added successfully to your household',
			id: insertResult.insertId,
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to add ingredient' }, { status: 500 });
	}
}

export const POST = withAuth(addIngredientHandler);
