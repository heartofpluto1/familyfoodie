import { NextResponse } from 'next/server';
import { getCurrentWeekRecipes, getCurrentWeek } from '@/lib/queries/menus';
import { withAuth } from '@/lib/auth-middleware';

async function handler() {
	try {
		const currentWeek = getCurrentWeek();
		const recipes = await getCurrentWeekRecipes();

		return NextResponse.json({
			week: currentWeek.week,
			year: currentWeek.year,
			recipes,
		});
	} catch (error) {
		console.error('Error fetching current week recipes:', error);
		return NextResponse.json({ error: 'Failed to fetch current week recipes' }, { status: 500 });
	}
}

export const GET = withAuth(handler);
