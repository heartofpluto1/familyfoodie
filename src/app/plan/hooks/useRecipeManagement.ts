import { Recipe } from '@/types/menus';
import { RecipeManagementActions } from '@/types/plan';
import { planService } from '../services/planService';

interface UseRecipeManagementProps {
	recipes: Recipe[];
	setRecipes: (recipes: Recipe[]) => void;
	setLoading: (loading: boolean) => void;
}

export function useRecipeManagement({ recipes, setRecipes, setLoading }: UseRecipeManagementProps): RecipeManagementActions {
	const findCompatibleRecipe = (availableRecipes: Recipe[], currentRecipes: Recipe[]): Recipe | null => {
		const usedPrimaryIngredients = new Set(currentRecipes.filter(r => r.ingredients && r.ingredients.length > 0).map(r => r.ingredients![0]));

		const usedSecondaryIngredients = new Set(currentRecipes.filter(r => r.ingredients && r.ingredients.length > 1).map(r => r.ingredients![1]));

		return (
			availableRecipes.find((recipe: Recipe) => {
				const ingredients = recipe.ingredients || [];
				if (ingredients.length === 0) return true;

				const primaryIngredient = ingredients[0];
				const secondaryIngredient = ingredients.length > 1 ? ingredients[1] : null;

				const primaryConflict = usedPrimaryIngredients.has(primaryIngredient);
				const secondaryConflict = secondaryIngredient && usedSecondaryIngredients.has(secondaryIngredient);

				return !primaryConflict && !secondaryConflict;
			}) || null
		);
	};

	const handleSwapRecipe = async (recipeToReplace: Recipe): Promise<void> => {
		setLoading(true);
		try {
			const result = await planService.randomizeRecipes();

			if (result.success && result.recipes && result.recipes.length > 0) {
				const currentIds = recipes.map(r => r.id);
				const availableReplacements = result.recipes.filter((r: Recipe) => !currentIds.includes(r.id));

				if (availableReplacements.length > 0) {
					const replacement = availableReplacements[0];
					setRecipes(recipes.map(r => (r.id === recipeToReplace.id ? replacement : r)));
				}
			}
		} finally {
			setLoading(false);
		}
	};

	const handleRemoveRecipe = (recipeToRemove: Recipe): void => {
		setRecipes(recipes.filter(r => r.id !== recipeToRemove.id));
	};

	const handleAddRecipe = (recipe: Recipe): void => {
		setRecipes([...recipes, recipe]);
	};

	const handleAddRandomRecipe = async (): Promise<void> => {
		setLoading(true);
		try {
			const result = await planService.randomizeRecipes();

			if (result.success && result.recipes && result.recipes.length > 0) {
				const currentIds = recipes.map(r => r.id);
				const availableRecipes = result.recipes.filter((r: Recipe) => !currentIds.includes(r.id));

				if (availableRecipes.length > 0) {
					const compatibleRecipe = findCompatibleRecipe(availableRecipes, recipes);

					if (compatibleRecipe) {
						setRecipes([...recipes, compatibleRecipe]);
					} else if (availableRecipes.length > 0) {
						setRecipes([...recipes, availableRecipes[0]]);
					}
				}
			}
		} finally {
			setLoading(false);
		}
	};

	return {
		handleSwapRecipe,
		handleRemoveRecipe,
		handleAddRecipe,
		handleAddRandomRecipe,
	};
}
