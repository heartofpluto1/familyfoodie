import { getRecipeWeeks } from '@/lib/recipeWeeks';

export async function GET() {
    return Response.json(await getRecipeWeeks(6))
}