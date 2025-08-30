import { NextRequest, NextResponse } from 'next/server';
import { deleteWeekRecipes } from '@/lib/queries/menus';
import { requireAuth } from '@/lib/auth/helpers';

export async function POST(req: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const { week, year } = await req.json();

		if (!week || !year) {
			return NextResponse.json({ error: 'Week and year are required' }, { status: 400 });
		}

		await deleteWeekRecipes(week, year, auth.household_id);

		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete week recipes' }, { status: 500 });
	}
}
