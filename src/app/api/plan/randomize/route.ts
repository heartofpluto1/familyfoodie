import { NextResponse } from 'next/server';
import { getRecipesForRandomization } from '@/lib/queries/menus';
import { Recipe } from '@/types/menus';
import { withAuth } from '@/lib/auth-middleware';

// Randomization logic with ingredient constraints
function selectRandomRecipes(availableRecipes: Recipe[], count: number = 3): Recipe[] {
	const selected: Recipe[] = [];
	const usedPrimaryIngredients = new Set<string>();
	const usedSecondaryIngredients = new Set<string>();
	const availableCopy = [...availableRecipes];

	// Shuffle the available recipes
	for (let i = availableCopy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[availableCopy[i], availableCopy[j]] = [availableCopy[j], availableCopy[i]];
	}

	for (const recipe of availableCopy) {
		if (selected.length >= count) break;

		const ingredients = recipe.ingredients || [];
		if (ingredients.length === 0) continue;

		const primaryIngredient = ingredients[0];
		const secondaryIngredient = ingredients.length > 1 ? ingredients[1] : null;

		// Check constraints
		const primaryConflict = usedPrimaryIngredients.has(primaryIngredient);
		const secondaryConflict = secondaryIngredient && usedSecondaryIngredients.has(secondaryIngredient);

		if (!primaryConflict && !secondaryConflict) {
			selected.push(recipe);
			usedPrimaryIngredients.add(primaryIngredient);
			if (secondaryIngredient) {
				usedSecondaryIngredients.add(secondaryIngredient);
			}
		}
	}

	return selected;
}

async function handler(request: Request) {
	try {
		// Get the count from query params
		const url = new URL(request.url);
		const countParam = url.searchParams.get('count');
		const count = countParam ? parseInt(countParam) : 3; // Default to 3 if not specified
		
		const availableRecipes = await getRecipesForRandomization();
		const randomizedRecipes = selectRandomRecipes(availableRecipes, count);

		return NextResponse.json({
			recipes: randomizedRecipes,
			totalAvailable: availableRecipes.length,
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to randomize recipes' }, { status: 500 });
	}
}

export const GET = withAuth(handler);
