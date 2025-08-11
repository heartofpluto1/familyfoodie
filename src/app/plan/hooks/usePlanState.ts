import { useState } from 'react';
import { Recipe } from '@/types/menus';
import { PlanState } from '@/types/plan';

interface UsePlanStateProps {
	initialRecipes: Recipe[];
	week: number;
	year: number;
}

export function usePlanState({ initialRecipes, week, year }: UsePlanStateProps) {
	const [state, setState] = useState<PlanState>({
		recipes: initialRecipes,
		isEditMode: false,
		isLoading: false,
		week,
		year,
	});

	const updateState = (updates: Partial<PlanState>) => {
		setState(prev => ({ ...prev, ...updates }));
	};

	const setRecipes = (recipes: Recipe[]) => {
		updateState({ recipes });
	};

	const setEditMode = (isEditMode: boolean) => {
		updateState({ isEditMode });
	};

	const setLoading = (isLoading: boolean) => {
		updateState({ isLoading });
	};

	const resetToInitial = () => {
		setRecipes(initialRecipes);
	};

	return {
		state,
		setRecipes,
		setEditMode,
		setLoading,
		resetToInitial,
	};
}
