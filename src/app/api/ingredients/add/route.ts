import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth } from '@/lib/auth-middleware';
import { RowDataPacket } from 'mysql2';

interface AddIngredientRequest {
	name: string;
	fresh: boolean;
	price: number | null;
	stockcode: number | null;
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

async function addIngredientHandler(request: NextRequest) {
	try {
		const body: AddIngredientRequest = await request.json();
		const { name, fresh, price, stockcode, supermarketCategoryId, pantryCategoryId } = body;

		// Validate required fields
		if (!name || !name.trim()) {
			return NextResponse.json({ error: 'Ingredient name is required' }, { status: 400 });
		}

		// Check if ingredient already exists
		const [existingRows] = await pool.execute<RowDataPacket[]>('SELECT id FROM ingredients WHERE name = ? AND public = 1', [name.trim()]);

		if (existingRows.length > 0) {
			return NextResponse.json({ error: 'An ingredient with this name already exists' }, { status: 400 });
		}

		// Add the new ingredient
		const [result] = await pool.execute(
			`INSERT INTO ingredients 
			 (name, fresh, cost, stockcode, supermarketCategory_id, pantryCategory_id, public) 
			 VALUES (?, ?, ?, ?, ?, ?, 1)`,
			[name.trim(), fresh, price, stockcode, supermarketCategoryId, pantryCategoryId]
		);

		const insertResult = result as { insertId: number };

		return NextResponse.json({
			success: true,
			message: 'Ingredient added successfully',
			id: insertResult.insertId,
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to add ingredient' }, { status: 500 });
	}
}

export const POST = withAuth(addIngredientHandler);
