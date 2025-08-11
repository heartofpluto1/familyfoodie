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
}

export function usePlanActions({ recipes, setRecipes, setEditMode, setLoading, resetToInitial, week, year }: UsePlanActionsProps): PlanActions {
	const { resetShoppingList } = useShoppingListSync();

	const handleEdit = async (): Promise<void> => {
		setEditMode(true);

		// If no recipes exist for the week, pre-populate with automated selection
		if (recipes.length === 0) {
			setLoading(true);
			try {
				const result = await planService.randomizeRecipes();
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
			const result = await planService.randomizeRecipes();
			if (result.success && result.recipes) {
				setRecipes(result.recipes);
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
