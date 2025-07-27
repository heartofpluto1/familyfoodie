import { getRecipeWeeks } from '@/lib/menus';
import { withAuth } from '@/lib/auth-middleware';

async function handler() {
	return Response.json(await getRecipeWeeks(6));
}

export const GET = withAuth(handler);
