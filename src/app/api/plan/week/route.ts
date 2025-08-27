import { NextResponse } from 'next/server';
import { getNextWeekRecipes } from '@/lib/queries/menus';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

async function getHandler(request: AuthenticatedRequest) {
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
		const recipes = await getNextWeekRecipes(request.household_id);

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

export const GET = withAuth(getHandler);
