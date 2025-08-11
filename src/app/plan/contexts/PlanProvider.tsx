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
}

const PlanContext = createContext<PlanContextType | null>(null);

export function PlanProvider({ children, initialRecipes, allRecipes, week, year, weekDates }: PlanProviderProps) {
	const { state, setRecipes, setEditMode, setLoading, resetToInitial } = usePlanState({ initialRecipes, week, year });

	const planActions = usePlanActions({
		recipes: state.recipes,
		setRecipes,
		setEditMode,
		setLoading,
		resetToInitial,
		week,
		year,
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
