import { NextResponse } from 'next/server';
import { getCurrentWeekRecipes, getCurrentWeek } from '@/lib/queries/menus';
import { requireAuth } from '@/lib/auth/helpers';

export async function GET(): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const currentWeek = getCurrentWeek();
		const recipes = await getCurrentWeekRecipes(auth.household_id);

		return NextResponse.json({
			week: currentWeek.week,
			year: currentWeek.year,
			recipes,
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch current week recipes' }, { status: 500 });
	}
}
