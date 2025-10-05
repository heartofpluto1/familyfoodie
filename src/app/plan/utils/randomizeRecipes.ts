import { Recipe } from '@/types/menus';

/**
 * Select random recipes with progressive protein/carb type filtering
 *
 * @param allRecipes - All available recipes
 * @param excludeRecipeIds - Set of recipe IDs to exclude (recipes already in current plan)
 * @param count - Number of recipes to select
 * @returns Array of randomly selected recipes
 *
 * Database Schema Context:
 * - recipes.primaryType_id → type_proteins (e.g., "Chicken", "Beef", "Fish")
 * - recipes.secondaryType_id → type_carbs (e.g., "Rice", "Pasta", "Quinoa")
 * - These are stored as primaryTypeName and secondaryTypeName in the Recipe type
 *
 * Algorithm (Progressive Filtering for True Randomness):
 * 1. Filter out excluded recipes (already in current plan)
 * 2. Randomly select ONE recipe from available pool
 * 3. Add to selection and track its primaryTypeName (protein) and secondaryTypeName (carb)
 * 4. Remove ALL recipes where:
 *    - primaryTypeName matches ANY selected primaryTypeName
 *    - OR secondaryTypeName matches ANY selected secondaryTypeName
 * 5. Repeat steps 2-4 until we have 'count' recipes or pool is exhausted
 *
 * Example:
 * - Select Recipe A: primaryTypeName="Chicken", secondaryTypeName="Rice"
 * - Remove all recipes with primaryTypeName="Chicken" OR secondaryTypeName="Rice"
 * - Select Recipe B: primaryTypeName="Beef", secondaryTypeName="Pasta"
 * - Remove all recipes with primaryTypeName="Beef" OR secondaryTypeName="Pasta"
 * - Continue until count reached
 *
 * This approach ensures:
 * - Each selection is truly random from remaining valid options
 * - No duplicate recipes within the plan
 * - No identical protein types (primaryTypeName) across selected recipes
 * - No identical carb types (secondaryTypeName) across selected recipes
 * - Progressive whittling of available pool based on type constraints
 * - Different results each time due to random selection at each step
 */
export function selectRandomRecipes(allRecipes: Recipe[], excludeRecipeIds: Set<number>, count: number = 3): Recipe[] {
	const selected: Recipe[] = [];
	const usedPrimaryTypes = new Set<string>();
	const usedSecondaryTypes = new Set<string>();

	// Filter out excluded recipes (already in current plan)
	let availableRecipes = allRecipes.filter(recipe => !excludeRecipeIds.has(recipe.id));

	// Progressive filtering: randomly select and remove conflicting recipes
	while (selected.length < count && availableRecipes.length > 0) {
		// Randomly select ONE recipe from current available pool
		const randomIndex = Math.floor(Math.random() * availableRecipes.length);
		const selectedRecipe = availableRecipes[randomIndex];

		// Add to selection
		selected.push(selectedRecipe);

		// CRITICAL: Remove the selected recipe from pool immediately to prevent duplicates
		// This must happen before type filtering, as recipes with undefined types won't be
		// filtered out by type conflicts and could be selected again
		availableRecipes.splice(randomIndex, 1);

		// Track protein/carb types from selected recipe
		const primaryType = selectedRecipe.primaryTypeName;
		const secondaryType = selectedRecipe.secondaryTypeName;

		if (primaryType) {
			usedPrimaryTypes.add(primaryType);
		}
		if (secondaryType) {
			usedSecondaryTypes.add(secondaryType);
		}

		// Remove ALL recipes where:
		// - Their primaryTypeName matches ANY already-selected primaryTypeName
		// - Their secondaryTypeName matches ANY already-selected secondaryTypeName
		availableRecipes = availableRecipes.filter(recipe => {
			const hasPrimaryConflict = recipe.primaryTypeName && usedPrimaryTypes.has(recipe.primaryTypeName);
			const hasSecondaryConflict = recipe.secondaryTypeName && usedSecondaryTypes.has(recipe.secondaryTypeName);

			// Keep recipe only if it has NO conflicts
			return !hasPrimaryConflict && !hasSecondaryConflict;
		});
	}

	return selected;
}
