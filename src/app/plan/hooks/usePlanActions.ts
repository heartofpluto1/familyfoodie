import { PlanActions } from '@/types/plan';
import { planService } from '../services/planService';
import { useShoppingListSync } from './useShoppingListSync';
import { Recipe } from '@/types/menus';
import { selectRandomRecipes } from '../utils/randomizeRecipes';
import { useRef } from 'react';

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
	onWeekDelete?: () => void;
	wasInitialEditMode?: boolean; // Track if we started in edit mode
	allRecipes: Recipe[];
	updateParentRecipes: (recipes: Recipe[]) => void;
}

export function usePlanActions({
	recipes,
	setRecipes,
	setEditMode,
	setLoading,
	resetToInitial,
	week,
	year,
	setAnimatingAutomate,
	setPendingRecipes,
	onWeekDelete,
	wasInitialEditMode,
	allRecipes,
	updateParentRecipes,
}: UsePlanActionsProps): PlanActions {
	const { resetShoppingList } = useShoppingListSync();
	const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const handleEdit = async (): Promise<void> => {
		setEditMode(true);

		// If no recipes exist for the week, pre-populate with automated selection
		if (recipes.length === 0) {
			const randomRecipes = selectRandomRecipes(allRecipes, new Set(), 3);
			setRecipes(randomRecipes);
		}
	};

	const handleCancel = (): void => {
		setEditMode(false);
		// If we started in edit mode (auto-populated), clear to empty
		if (wasInitialEditMode) {
			setRecipes([]);
		} else {
			resetToInitial();
		}
	};

	const handleAutomate = async (): Promise<void> => {
		setLoading(true);
		try {
			// Use current recipe count if recipes exist, otherwise default to 3
			const count = recipes.length > 0 ? recipes.length : 3;
			const randomRecipes = selectRandomRecipes(allRecipes, new Set(), count);

			if (setAnimatingAutomate && setPendingRecipes) {
				// Cancel any pending animation timeout to prevent overlapping state updates
				if (animationTimeoutRef.current) {
					clearTimeout(animationTimeoutRef.current);
				}

				// Store the new recipes and trigger animations
				setPendingRecipes(randomRecipes);
				setAnimatingAutomate(true);

				// After animations complete, update the actual state and clear loading
				animationTimeoutRef.current = setTimeout(() => {
					setPendingRecipes(null);
					setAnimatingAutomate(false);
					setLoading(false);
					setRecipes(randomRecipes);
					animationTimeoutRef.current = null;
				}, 300);
			} else {
				// Fallback to immediate update if animation props not provided
				setRecipes(randomRecipes);
				setLoading(false);
			}
		} catch (error) {
			setLoading(false);
			throw error;
		}
	};

	const handleSave = async (): Promise<void> => {
		setLoading(true);
		try {
			const result = await planService.saveWeekPlan(
				week,
				year,
				recipes.map(r => ({ id: r.id, shop_qty: r.shop_qty }))
			);

			if (result.success) {
				// Update parent state with saved recipes (including updated shop_qty values)
				updateParentRecipes(recipes);
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

				// Remove the week from multi-week state if callback provided
				if (onWeekDelete) {
					onWeekDelete();
				}
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
