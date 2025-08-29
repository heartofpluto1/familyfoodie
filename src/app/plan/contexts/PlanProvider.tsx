'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { Recipe } from '@/types/menus';
import { PlanContextType } from '@/types/plan';
import { usePlanState } from '../hooks/usePlanState';
import { usePlanActions } from '../hooks/usePlanActions';
import { useRecipeManagement } from '../hooks/useRecipeManagement';

interface PlanProviderProps {
	children: ReactNode;
	initialRecipes: Recipe[];
	allRecipes: Recipe[];
	week: number;
	year: number;
	weekDates: string;
	onRecipesChange?: (recipes: Recipe[]) => void;
	initialEditMode?: boolean;
	onWeekDelete?: () => void;
}

const PlanContext = createContext<PlanContextType | null>(null);

export function PlanProvider({
	children,
	initialRecipes,
	allRecipes,
	week,
	year,
	weekDates,
	onRecipesChange,
	initialEditMode,
	onWeekDelete,
}: PlanProviderProps) {
	const {
		state,
		setRecipes: originalSetRecipes,
		setEditMode,
		setLoading,
		resetToInitial,
	} = usePlanState({
		initialRecipes,
		week,
		year,
		initialEditMode,
	});
	const [animatingAutomate, setAnimatingAutomate] = React.useState(false);
	const [pendingRecipes, setPendingRecipes] = React.useState<Recipe[] | null>(null);

	// Wrapped setRecipes that calls the callback
	const setRecipes = (recipes: Recipe[]) => {
		originalSetRecipes(recipes);
		if (onRecipesChange) {
			onRecipesChange(recipes);
		}
	};

	const planActions = usePlanActions({
		recipes: state.recipes,
		setRecipes,
		setEditMode,
		setLoading,
		resetToInitial,
		week,
		year,
		setAnimatingAutomate,
		setPendingRecipes,
		onWeekDelete,
		wasInitialEditMode: initialEditMode,
	});

	const recipeActions = useRecipeManagement({
		recipes: state.recipes,
		setRecipes,
		setLoading,
	});

	const contextValue: PlanContextType = {
		state,
		planActions,
		recipeActions,
		allRecipes,
		weekDates,
		initialRecipes,
		animatingAutomate,
		pendingRecipes,
	};

	return <PlanContext.Provider value={contextValue}>{children}</PlanContext.Provider>;
}

export const usePlanContext = () => {
	const context = useContext(PlanContext);
	if (!context) {
		throw new Error('usePlanContext must be used within PlanProvider');
	}
	return context;
};
