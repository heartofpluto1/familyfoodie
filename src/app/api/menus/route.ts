import { NextResponse } from 'next/server';
import { getRecipeWeeks } from '@/lib/queries/menus';
import { withAuth } from '@/lib/auth-middleware';

async function handler() {
	try {
		const result = await getRecipeWeeks(6);
		return NextResponse.json({ ...result, success: true }, { status: 200 });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : error;
		return NextResponse.json({ success: false, error: `Internal server error: ${errorMessage}` }, { status: 500 });
	}
}

export const GET = withAuth(handler);
