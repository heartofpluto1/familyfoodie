import { PlanActions } from '@/types/plan';
import { planService } from '../services/planService';
import { useShoppingListSync } from './useShoppingListSync';
import { Recipe } from '@/types/menus';

interface UsePlanActionsProps {
	recipes: Recipe[];
	setRecipes: (recipes: Recipe[]) => void;
	setEditMode: (editMode: boolean) => void;
	setLoading: (loading: boolean) => void;
	resetToInitial: () => void;
	week: number;
	year: number;
	setAnimatingAutomate?: (animating: boolean) => void;
	setPendingRecipes?: (recipes: Recipe[] | null) => void;
}

export function usePlanActions({ recipes, setRecipes, setEditMode, setLoading, resetToInitial, week, year, setAnimatingAutomate, setPendingRecipes }: UsePlanActionsProps): PlanActions {
	const { resetShoppingList } = useShoppingListSync();

	const handleEdit = async (): Promise<void> => {
		setEditMode(true);

		// If no recipes exist for the week, pre-populate with automated selection
		if (recipes.length === 0) {
			setLoading(true);
			try {
				const result = await planService.randomizeRecipes(3);
				if (result.success && result.recipes) {
					setRecipes(result.recipes);
				}
			} finally {
				setLoading(false);
			}
		}
	};

	const handleCancel = (): void => {
		setEditMode(false);
		resetToInitial();
	};

	const handleAutomate = async (): Promise<void> => {
		setLoading(true);
		try {
			// Use current recipe count if recipes exist, otherwise default to 3
			const count = recipes.length > 0 ? recipes.length : 3;
			const result = await planService.randomizeRecipes(count);
			if (result.success && result.recipes) {
				if (setAnimatingAutomate && setPendingRecipes) {
					// Store the new recipes and trigger animations
					setPendingRecipes(result.recipes);
					setAnimatingAutomate(true);
					
					// After animations complete, update the actual state
					setTimeout(() => {
						setRecipes(result.recipes);
						setPendingRecipes(null);
						setAnimatingAutomate(false);
					}, 400);
				} else {
					// Fallback to immediate update if animation props not provided
					setRecipes(result.recipes);
				}
			}
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async (): Promise<void> => {
		setLoading(true);
		try {
			const result = await planService.saveWeekPlan(
				week,
				year,
				recipes.map(r => r.id)
			);

			if (result.success) {
				setEditMode(false);
				await resetShoppingList(week, year);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (): Promise<void> => {
		setLoading(true);
		try {
			const result = await planService.deleteWeekPlan(week, year);

			if (result.success) {
				setRecipes([]);
				setEditMode(false);
				await resetShoppingList(week, year);
			}
		} finally {
			setLoading(false);
		}
	};

	return {
		handleEdit,
		handleCancel,
		handleAutomate,
		handleSave,
		handleDelete,
	};
}
