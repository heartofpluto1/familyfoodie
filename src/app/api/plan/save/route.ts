import { NextResponse } from 'next/server';
import { saveWeekRecipes } from '@/lib/queries/menus';
import { requireAuth } from '@/lib/auth/helpers';

export async function POST(request: Request): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const { week, year, recipeIds } = await request.json();

		if (!week || !year || !Array.isArray(recipeIds)) {
			return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
		}

		await saveWeekRecipes(week, year, recipeIds, auth.household_id);

		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save week recipes' }, { status: 500 });
	}
}
