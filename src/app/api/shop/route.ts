// app/api/shop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import pool from '@/lib/db.js';

function getWeekOfYear(date = new Date()) {
	const start = new Date(date.getFullYear(), 0, 1);
	const timeDiff = date.getTime() - start.getTime();
	const days = Math.floor(timeDiff / (24 * 60 * 60 * 1000)) + 1;
	return Math.ceil(days / 7);
}

async function handler(req: NextRequest) {
	const params = req.nextUrl.searchParams;
	const endpoint = params.get('endpoint');
	const week = params.get('week') || getWeekOfYear().toString();
	const year = params.get('year') || new Date().getFullYear().toString();

	if (req.method !== 'GET') {
		return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
	}

	try {
		switch (endpoint) {
			case 'ingredients':
				return await getIngredients();
			case 'week':
				return await getShoppingListWeek(week, year);
			default:
				return NextResponse.json({ success: false, error: 'Endpoint not found' }, { status: 404 });
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		return NextResponse.json({ success: false, error: `Internal server error: ${errorMessage}` }, { status: 500 });
	}
}

async function getIngredients() {
	try {
		const [rows] = await pool.execute(`
      SELECT 
        id,
        name as ingredient__name
      FROM menus_ingredient 
      WHERE public = 1
      ORDER BY name
    `);

		return NextResponse.json({ data: rows, success: true }, { status: 200 });
	} catch (error) {
		throw error;
	}
}

async function getShoppingListWeek(week: string, year: string) {
	try {
		// Get fresh ingredients from shopping list
		const [freshRows] = await pool.execute(
			`
      SELECT 
        sl.id,
        sl.name,
        sl.cost,
        sl.stockcode,
        sl.purchased,
        sl.sort,
        COALESCE(ri.quantity, '') as quantity,
        COALESCE(m.name, '') as quantityMeasure,
        COALESCE(ri.ingredient_id, NULL) as ingredientId,
        COALESCE(i.cost, sl.cost) as defaultCost,
        COALESCE(sc.name, '') as supermarketCategory,
        COALESCE(i.name, sl.name) as name,
        sl.fresh
      FROM menus_shoppinglist sl
      LEFT JOIN menus_recipeingredient ri ON sl.recipeIngredient_id = ri.id
      LEFT JOIN menus_ingredient i ON ri.ingredient_id = i.id
      LEFT JOIN menus_measure m ON ri.quantityMeasure_id = m.id
      LEFT JOIN menus_supermarketcategory sc ON COALESCE(sl.supermarketCategory_id, i.supermarketCategory_id) = sc.id
      WHERE sl.week = ? AND sl.year = ? AND sl.fresh = 1 AND sl.account_id = 1
      ORDER BY sl.sort, sl.id
    `,
			[week, year]
		);

		// Get pantry ingredients from shopping list
		const [pantryRows] = await pool.execute(
			`
      SELECT 
        sl.id,
        sl.name,
        sl.sort,
        COALESCE(ri.quantity, '') as quantity,
        COALESCE(m.name, '') as quantityMeasure,
        COALESCE(pc.name, '') as pantryCategory,
        COALESCE(i.name, sl.name) as name,
        sl.fresh
      FROM menus_shoppinglist sl
      LEFT JOIN menus_recipeingredient ri ON sl.recipeIngredient_id = ri.id
      LEFT JOIN menus_ingredient i ON ri.ingredient_id = i.id
      LEFT JOIN menus_measure m ON ri.quantityMeasure_id = m.id
      LEFT JOIN menus_pantrycategory pc ON i.pantryCategory_id = pc.id
      WHERE sl.week = ? AND sl.year = ? AND sl.fresh = 0 AND sl.account_id = 1
      ORDER BY sl.sort, sl.id
    `,
			[week, year]
		);

		return NextResponse.json(
			{
				success: true,
				data: {
					fresh: freshRows,
					pantry: pantryRows,
				},
			},
			{ status: 200 }
		);
	} catch (error) {
		throw error;
	}
}

export const GET = withAuth(handler);
