import { NextResponse } from 'next/server';
import { deleteWeekRecipes } from '@/lib/queries/menus';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

async function handler(req: AuthenticatedRequest) {
	try {
		const { week, year } = await req.json();

		if (!week || !year) {
			return NextResponse.json({ error: 'Week and year are required' }, { status: 400 });
		}

		await deleteWeekRecipes(week, year, req.household_id);

		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete week recipes' }, { status: 500 });
	}
}

export const POST = withAuth(handler);
