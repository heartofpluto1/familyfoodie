// app/api/shop/route.ts
import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { getIngredients, getShoppingList } from '@/lib/queries/shop';

function getWeekOfYear(date = new Date()) {
	const start = new Date(date.getFullYear(), 0, 1);
	const timeDiff = date.getTime() - start.getTime();
	const days = Math.floor(timeDiff / (24 * 60 * 60 * 1000)) + 1;
	return Math.ceil(days / 7);
}

function validateWeek(week: string): { valid: boolean; error?: string } {
	const weekNum = parseInt(week, 10);
	if (isNaN(weekNum)) {
		return { valid: false, error: 'Invalid week parameter. Week must be a number between 1 and 53.' };
	}
	if (weekNum < 1 || weekNum > 53) {
		return { valid: false, error: 'Invalid week parameter. Week must be a number between 1 and 53.' };
	}
	return { valid: true };
}

function validateYear(year: string): { valid: boolean; error?: string } {
	const yearNum = parseInt(year, 10);
	if (isNaN(yearNum) || year.length !== 4) {
		return { valid: false, error: 'Invalid year parameter. Year must be a valid 4-digit number.' };
	}
	if (yearNum < 2015 || yearNum > 2030) {
		return { valid: false, error: 'Invalid year parameter. Year must be between 2015 and 2030.' };
	}
	return { valid: true };
}

async function handler(req: AuthenticatedRequest) {
	const params = req.nextUrl.searchParams;
	const endpoint = params.get('endpoint');

	// Validate endpoint parameter
	if (!endpoint || endpoint === '') {
		return NextResponse.json(
			{
				success: false,
				error: 'Endpoint parameter is required',
				code: 'MISSING_PARAMETER',
			},
			{ status: 404 }
		);
	}

	try {
		switch (endpoint) {
			case 'ingredients':
				const ingredients = await getIngredients(req.household_id);
				return NextResponse.json({ data: ingredients, success: true }, { status: 200 });

			case 'week':
				const week = params.get('week') || getWeekOfYear().toString();
				const year = params.get('year') || new Date().getFullYear().toString();

				// Validate week parameter if provided
				if (params.get('week')) {
					const weekValidation = validateWeek(week);
					if (!weekValidation.valid) {
						return NextResponse.json(
							{
								success: false,
								error: weekValidation.error,
								code: 'INVALID_PARAMETER',
							},
							{ status: 400 }
						);
					}
				}

				// Validate year parameter if provided
				if (params.get('year')) {
					const yearValidation = validateYear(year);
					if (!yearValidation.valid) {
						return NextResponse.json(
							{
								success: false,
								error: yearValidation.error,
								code: 'INVALID_PARAMETER',
							},
							{ status: 400 }
						);
					}
				}

				const listWeeks = await getShoppingList(week, year, req.household_id);
				return NextResponse.json(
					{
						success: true,
						data: listWeeks,
					},
					{ status: 200 }
				);

			default:
				return NextResponse.json(
					{
						success: false,
						error: 'Invalid endpoint. Valid endpoints are: ingredients, week',
						code: 'INVALID_ENDPOINT',
					},
					{ status: 404 }
				);
		}
	} catch (error) {
		// Log the actual error for debugging (in production, this would go to a logging service)
		console.error('Shop API Error:', error);

		// Determine the appropriate error message based on the endpoint
		let userMessage = 'An unexpected error occurred. Please try again later.';
		if (endpoint === 'ingredients') {
			userMessage = 'Failed to fetch ingredients. Please try again later.';
		} else if (endpoint === 'week') {
			userMessage = 'Failed to fetch shopping list. Please try again later.';
		}

		return NextResponse.json(
			{
				success: false,
				error: userMessage,
				code: 'INTERNAL_ERROR',
			},
			{ status: 500 }
		);
	}
}

export const GET = withAuth(handler);
