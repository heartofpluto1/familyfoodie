import { NextResponse, NextRequest } from 'next/server';
import { getNextWeekRecipes } from '@/lib/queries/menus';
import { requireAuth } from '@/lib/auth/helpers';

export async function GET(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const searchParams = request.nextUrl.searchParams;
		const week = parseInt(searchParams.get('week') || '0');
		const year = parseInt(searchParams.get('year') || '0');

		if (!week || !year) {
			return NextResponse.json({ error: 'Week and year parameters are required' }, { status: 400 });
		}

		// For now, we'll use the existing getNextWeekRecipes function
		// In a real implementation, you might want to create a more specific function
		// that can fetch recipes for any week/year combination
		const recipes = await getNextWeekRecipes(auth.household_id);

		return NextResponse.json({
			success: true,
			recipes: recipes || [],
			week,
			year,
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch week recipes' }, { status: 500 });
	}
}
