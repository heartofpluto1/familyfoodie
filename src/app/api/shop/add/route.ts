import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

async function handler(request: AuthenticatedRequest) {
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
					FROM ingredients i
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

			// Get the current max sort value for the shopping list (household-scoped)
			const [sortRows] = await connection.execute(
				`
				SELECT COALESCE(MAX(sort), -1) as max_sort 
				FROM shopping_lists 
				WHERE week = ? AND year = ? AND household_id = ?
			`,
				[week, year, request.household_id]
			);

			const maxSort = (sortRows as { max_sort: number }[])[0].max_sort;
			const newSort = maxSort + 1;

			let insertResult;

			if (knownIngredient) {
				// Add known ingredient with data from ingredients table
				[insertResult] = await connection.execute(
					`
					INSERT INTO shopping_lists 
					(week, year, household_id, fresh, name, sort, cost, recipeIngredient_id, purchased, stockcode) 
					VALUES (?, ?, ?, 1, ?, ?, ?, NULL, 0, ?)
				`,
					[week, year, request.household_id, name, newSort, knownIngredient.cost, knownIngredient.stockcode]
				);
			} else {
				// Add unknown ingredient as text with null values
				[insertResult] = await connection.execute(
					`
					INSERT INTO shopping_lists 
					(week, year, household_id, fresh, name, sort, cost, recipeIngredient_id, purchased, stockcode) 
					VALUES (?, ?, ?, 1, ?, ?, NULL, NULL, 0, NULL)
				`,
					[week, year, request.household_id, name, newSort]
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
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to add item' }, { status: 500 });
	}
}

export const PUT = withAuth(handler);
