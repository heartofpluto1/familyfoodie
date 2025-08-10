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
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch current week recipes' }, { status: 500 });
	}
}

export const GET = withAuth(handler);
