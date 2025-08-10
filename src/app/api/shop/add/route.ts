import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth } from '@/lib/auth-middleware';

async function handler(request: NextRequest) {
	try {
		const body = await request.json();
		const { week, year, name, ingredient_id } = body;

		if (!week || !year || !name) {
			return NextResponse.json({ error: 'Week, year, and name are required' }, { status: 400 });
		}

		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();

			let knownIngredient = null;

			// If ingredient_id was provided, get the ingredient data
			if (ingredient_id) {
				const [ingredientRows] = await connection.execute(
					`
					SELECT 
						i.id as ingredient_id,
						i.cost,
						i.stockcode,
						i.supermarketCategory_id
					FROM menus_ingredient i
					WHERE i.id = ? AND i.public = 1
					LIMIT 1
				`,
					[ingredient_id]
				);

				const ingredient = ingredientRows as {
					ingredient_id: number;
					cost: number | null;
					stockcode: string | null;
					supermarketCategory_id: number | null;
				}[];
				knownIngredient = ingredient.length > 0 ? ingredient[0] : null;
			}

			// Get the current max sort value for the shopping list
			const [sortRows] = await connection.execute(
				`
				SELECT COALESCE(MAX(sort), -1) as max_sort 
				FROM menus_shoppinglist 
				WHERE week = ? AND year = ? AND account_id = 1
			`,
				[week, year]
			);

			const maxSort = (sortRows as { max_sort: number }[])[0].max_sort;
			const newSort = maxSort + 1;

			let insertResult;

			if (knownIngredient) {
				// Add known ingredient with data from menus_ingredient table
				[insertResult] = await connection.execute(
					`
					INSERT INTO menus_shoppinglist 
					(week, year, fresh, name, sort, cost, recipeIngredient_id, purchased, account_id, stockcode, supermarketCategory_id) 
					VALUES (?, ?, 1, ?, ?, ?, NULL, 0, 1, ?, ?)
				`,
					[week, year, name, newSort, knownIngredient.cost, knownIngredient.stockcode, knownIngredient.supermarketCategory_id]
				);
			} else {
				// Add unknown ingredient as text with null values
				[insertResult] = await connection.execute(
					`
					INSERT INTO menus_shoppinglist 
					(week, year, fresh, name, sort, cost, recipeIngredient_id, purchased, account_id, stockcode, supermarketCategory_id) 
					VALUES (?, ?, 1, ?, ?, NULL, NULL, 0, 1, NULL, NULL)
				`,
					[week, year, name, newSort]
				);
			}

			await connection.commit();

			const newItemId = (insertResult as { insertId: number }).insertId;

			return NextResponse.json({ id: newItemId });
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	} catch (error) {
		console.error('Error adding shopping list item:', error);
		return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
	}
}

export const PUT = withAuth(handler);
