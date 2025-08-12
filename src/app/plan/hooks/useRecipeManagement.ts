import { Recipe } from '@/types/menus';
import { RecipeManagementActions } from '@/types/plan';
import { planService } from '../services/planService';

interface UseRecipeManagementProps {
	recipes: Recipe[];
	setRecipes: (recipes: Recipe[]) => void;
	setLoading: (loading: boolean) => void;
}

export function useRecipeManagement({ recipes, setRecipes, setLoading }: UseRecipeManagementProps): RecipeManagementActions {
	const handleSwapRecipe = async (): Promise<Recipe | null> => {
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
