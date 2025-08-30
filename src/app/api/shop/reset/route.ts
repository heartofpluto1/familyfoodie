import { NextRequest, NextResponse } from 'next/server';
import { resetShoppingListFromRecipes } from '@/lib/queries/menus';
import { requireAuth } from '@/lib/auth/helpers';

export async function POST(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const body = await request.json();
		const { week, year } = body;

		// Check if both fields are missing or null/undefined
		if ((week === undefined || week === null) && (year === undefined || year === null)) {
			return NextResponse.json(
				{
					success: false,
					error: 'Missing required fields',
					code: 'VALIDATION_ERROR',
					details: 'All fields (week, year) are required',
				},
				{ status: 400 }
			);
		}

		// Check individual missing fields (null/undefined)
		if (week === undefined || week === null) {
			return NextResponse.json(
				{
					success: false,
					error: 'Missing required field: week',
					code: 'VALIDATION_ERROR',
					details: {
						field: 'week',
						message: 'Week is required',
					},
				},
				{ status: 400 }
			);
		}

		if (year === undefined || year === null) {
			return NextResponse.json(
				{
					success: false,
					error: 'Missing required field: year',
					code: 'VALIDATION_ERROR',
					details: {
						field: 'year',
						message: 'Year is required',
					},
				},
				{ status: 400 }
			);
		}

		// Convert string numbers to numbers (like other shop routes)
		const weekNum = typeof week === 'string' ? parseInt(week, 10) : week;
		const yearNum = typeof year === 'string' ? parseInt(year, 10) : year;

		// Validate week type and range
		if (typeof weekNum !== 'number' || isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid week number',
					code: 'VALIDATION_ERROR',
					details: 'Week must be a number between 1 and 53',
				},
				{ status: 400 }
			);
		}

		// Validate year type and range
		if (typeof yearNum !== 'number' || isNaN(yearNum) || yearNum < 2015 || yearNum > 2050) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid year',
					code: 'VALIDATION_ERROR',
					details: 'Year must be between 2015 and 2050',
				},
				{ status: 400 }
			);
		}

		await resetShoppingListFromRecipes(weekNum, yearNum, auth.household_id);

		return NextResponse.json({ success: true });
	} catch (error) {
		// Handle JSON parsing errors specifically
		if (error instanceof SyntaxError && error.message.includes('JSON')) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid request format',
					code: 'INVALID_JSON',
					details: 'Request body must be valid JSON',
				},
				{ status: 400 }
			);
		}

		// Handle database/query errors
		if (error instanceof Error) {
			return NextResponse.json(
				{
					success: false,
					error: 'Database operation failed',
					code: 'DATABASE_ERROR',
					details: error.message,
				},
				{ status: 500 }
			);
		}

		// Handle unknown errors
		return NextResponse.json(
			{
				success: false,
				error: 'Internal server error',
				code: 'INTERNAL_ERROR',
				details: 'An unexpected error occurred',
			},
			{ status: 500 }
		);
	}
}
