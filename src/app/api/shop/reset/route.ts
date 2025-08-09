import { NextRequest, NextResponse } from 'next/server';
import { resetShoppingListFromRecipes } from '@/lib/queries/menus';
import { withAuth } from '@/lib/auth-middleware';

async function handler(request: NextRequest) {
	try {
		const { week, year } = await request.json();

		if (!week || !year) {
			return NextResponse.json({ error: 'Week and year are required' }, { status: 400 });
		}

		await resetShoppingListFromRecipes(week, year);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error resetting shopping list:', error);
		return NextResponse.json({ error: 'Failed to reset shopping list' }, { status: 500 });
	}
}

export const POST = withAuth(handler);
