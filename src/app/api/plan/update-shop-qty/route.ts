import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { requireAuth } from '@/lib/auth/helpers';

interface UpdatePlanShopQtyRequest {
	week: number;
	year: number;
	recipe_id: number;
	shop_qty: 2 | 4;
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	let body: UpdatePlanShopQtyRequest;

	// Parse and validate JSON
	try {
		body = await request.json();
	} catch (error) {
		console.error('[UPDATE-PLAN-SHOP-QTY] Failed to parse JSON:', error);
		return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const { week, year, recipe_id, shop_qty } = body;

	// Validate required fields
	if (!week || !year || !recipe_id || !shop_qty) {
		return NextResponse.json({ error: 'Week, year, recipe_id, and shop_qty are required' }, { status: 400 });
	}

	// Validate week and year
	if (typeof week !== 'number' || !Number.isInteger(week) || week < 1 || week > 53) {
		return NextResponse.json({ error: 'Week must be an integer between 1 and 53' }, { status: 400 });
	}

	if (typeof year !== 'number' || !Number.isInteger(year) || year < 2000 || year > 2100) {
		return NextResponse.json({ error: 'Year must be a valid integer between 2000 and 2100' }, { status: 400 });
	}

	// Validate recipe_id
	if (typeof recipe_id !== 'number' || !Number.isInteger(recipe_id) || recipe_id <= 0) {
		return NextResponse.json({ error: 'Recipe ID must be a positive integer' }, { status: 400 });
	}

	// Validate shop_qty
	if (shop_qty !== 2 && shop_qty !== 4) {
		return NextResponse.json({ error: 'Shop quantity must be either 2 or 4' }, { status: 400 });
	}

	try {
		// Update the shop_qty for the specific plan entry
		// Uses week, year, recipe_id, and household_id to identify the plan entry
		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE plans
			 SET shop_qty = ?
			 WHERE week = ? AND year = ? AND recipe_id = ? AND household_id = ?`,
			[shop_qty, week, year, recipe_id, auth.household_id]
		);

		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Plan entry not found or access denied' }, { status: 404 });
		}

		return NextResponse.json({
			success: true,
			message: 'Plan shop quantity updated successfully',
			shop_qty,
		});
	} catch (error: unknown) {
		console.error('[UPDATE-PLAN-SHOP-QTY] Error occurred:', error);
		console.error('[UPDATE-PLAN-SHOP-QTY] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('[UPDATE-PLAN-SHOP-QTY] Returning 500 with error:', errorMessage);

		return NextResponse.json(
			{
				error: 'Failed to update plan shop quantity',
				debug: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
			},
			{ status: 500 }
		);
	}
}
