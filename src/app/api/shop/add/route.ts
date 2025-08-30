import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { requireAuth } from '@/lib/auth/helpers';

export async function PUT(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		let body;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid request format',
					code: 'INVALID_REQUEST_FORMAT',
				},
				{ status: 400 }
			);
		}

		const { week, year, name, ingredient_id } = body;

		// Validate required fields with specific error messages
		const missingFields = [];
		if (!week) missingFields.push('week');
		if (!year) missingFields.push('year');
		if (!name) missingFields.push('name');

		if (missingFields.length > 0) {
			// Handle single missing field with specific message
			if (missingFields.length === 1) {
				const field = missingFields[0];
				return NextResponse.json(
					{
						success: false,
						error: `Missing required field: ${field}`,
						code: 'VALIDATION_ERROR',
						details: {
							field: field,
							message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required`,
						},
					},
					{ status: 400 }
				);
			}

			// Handle multiple missing fields
			return NextResponse.json(
				{
					success: false,
					error: 'Missing required fields',
					code: 'VALIDATION_ERROR',
					details: {
						fields: missingFields,
						message: `${missingFields.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(' and ')} are required`,
					},
				},
				{ status: 400 }
			);
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
				[week, year, auth.household_id]
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
					[week, year, auth.household_id, name, newSort, knownIngredient.cost, knownIngredient.stockcode]
				);
			} else {
				// Add unknown ingredient as text with null values
				[insertResult] = await connection.execute(
					`
					INSERT INTO shopping_lists 
					(week, year, household_id, fresh, name, sort, cost, recipeIngredient_id, purchased, stockcode) 
					VALUES (?, ?, ?, 1, ?, ?, NULL, NULL, 0, NULL)
				`,
					[week, year, auth.household_id, name, newSort]
				);
			}

			await connection.commit();

			const newItemId = (insertResult as { insertId: number }).insertId;

			return NextResponse.json(
				{
					success: true,
					data: { id: newItemId },
				},
				{ status: 201 }
			);
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	} catch (error) {
		// Handle specific error types
		if (error instanceof Error) {
			if (error.message.includes('Connection pool exhausted')) {
				return NextResponse.json(
					{
						success: false,
						error: 'Database connection error',
						code: 'DATABASE_CONNECTION_ERROR',
					},
					{ status: 500 }
				);
			}
			// Default database error for Error instances
			return NextResponse.json(
				{
					success: false,
					error: 'Failed to add item to shopping list',
					code: 'DATABASE_ERROR',
				},
				{ status: 500 }
			);
		}

		// Handle non-Error exceptions (e.g., string throws)
		return NextResponse.json(
			{
				success: false,
				error: 'An unexpected error occurred',
				code: 'INTERNAL_SERVER_ERROR',
			},
			{ status: 500 }
		);
	}
}
