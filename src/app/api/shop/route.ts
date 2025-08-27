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

async function handler(req: AuthenticatedRequest) {
	const params = req.nextUrl.searchParams;
	const endpoint = params.get('endpoint');
	const week = params.get('week') || getWeekOfYear().toString();
	const year = params.get('year') || new Date().getFullYear().toString();

	try {
		switch (endpoint) {
			case 'ingredients':
				const ingredients = await getIngredients(req.household_id);
				return NextResponse.json({ data: ingredients, success: true }, { status: 200 });
			case 'week':
				const listWeeks = await getShoppingList(week, year, req.household_id);
				return NextResponse.json(
					{
						success: true,
						data: listWeeks,
					},
					{ status: 200 }
				);
			default:
				return NextResponse.json({ success: false, error: 'Endpoint not found' }, { status: 404 });
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : error;
		return NextResponse.json({ success: false, error: `Internal server error: ${errorMessage}` }, { status: 500 });
	}
}

export const GET = withAuth(handler);
