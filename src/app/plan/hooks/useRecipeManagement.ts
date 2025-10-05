import { Recipe } from '@/types/menus';
import { RecipeManagementActions } from '@/types/plan';
import { selectRandomRecipes } from '../utils/randomizeRecipes';

interface UseRecipeManagementProps {
	recipes: Recipe[];
	setRecipes: (recipes: Recipe[]) => void;
	setLoading: (loading: boolean) => void;
	allRecipes: Recipe[];
}

export function useRecipeManagement({ recipes, setRecipes, setLoading, allRecipes }: UseRecipeManagementProps): RecipeManagementActions {
	const handleSwapRecipe = async (): Promise<Recipe | null> => {
		setLoading(true);
		try {
			// Exclude recipes already in the plan
			const excludeSet = new Set(recipes.map(r => r.id));
			const [replacement] = selectRandomRecipes(allRecipes, excludeSet, 1);

			// Don't update state here - just return the new recipe
			return replacement || null;
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
			// Exclude recipes already in the plan
			const excludeSet = new Set(recipes.map(r => r.id));
			const [newRecipe] = selectRandomRecipes(allRecipes, excludeSet, 1);

			if (newRecipe) {
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
