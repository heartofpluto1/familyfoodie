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

	const handleSwapRecipe = async (recipeToReplace: Recipe): Promise<Recipe | null> => {
		setLoading(true);
		try {
			// Request just 1 recipe for swapping
			const result = await planService.randomizeRecipes(1);

			if (result.success && result.recipes && result.recipes.length > 0) {
				const replacement = result.recipes[0];
				// Don't update state here - just return the new recipe
				return replacement;
			}
			return null;
		} catch (error) {
			console.error('Error swapping recipe:', error);
			return null;
		}
		// Note: Don't call setLoading(false) here to avoid interfering with automate animation
	};

	const commitSwapRecipe = (recipeToReplace: Recipe, newRecipe: Recipe): void => {
		setRecipes(recipes.map(r => (r.id === recipeToReplace.id ? newRecipe : r)));
		setLoading(false);
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
			// Request just 1 recipe to add
			const result = await planService.randomizeRecipes(1);

			if (result.success && result.recipes && result.recipes.length > 0) {
				const newRecipe = result.recipes[0];
				setRecipes([...recipes, newRecipe]);
			}
		} finally {
			setLoading(false);
		}
	};

	return {
		handleSwapRecipe,
		commitSwapRecipe,
		handleRemoveRecipe,
		handleAddRecipe,
		handleAddRandomRecipe,
	};
}
