import { getRecipeWeeks } from '@/lib/menus';

export async function GET() {
	return Response.json(await getRecipeWeeks(6));
}
