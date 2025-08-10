import { NextRequest, NextResponse } from 'next/server';
import { saveWeekRecipes } from '@/lib/queries/menus';
import { withAuth } from '@/lib/auth-middleware';

async function handler(request: NextRequest) {
	try {
		const { week, year, recipeIds } = await request.json();

		if (!week || !year || !Array.isArray(recipeIds)) {
			return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
		}

		await saveWeekRecipes(week, year, recipeIds);

		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save week recipes' }, { status: 500 });
	}
}

export const POST = withAuth(handler);
