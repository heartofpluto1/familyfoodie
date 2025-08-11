'use client';

import React from 'react';
import { Recipe } from '@/types/menus';
import { PlanProvider, usePlanContext } from './contexts/PlanProvider';
import { PlanHeader } from './components/PlanHeader';
import { EditControls } from './components/EditControls';
import { RecipeGrid } from './components/RecipeGrid';
import styles from './plan.module.css';

interface PlanClientProps {
	week: number;
	year: number;
	weekDates: string;
	initialRecipes: Recipe[];
	allRecipes: Recipe[];
}

function PlanContent() {
	const { state, planActions, recipeActions, allRecipes, weekDates } = usePlanContext();

	return (
		<main className="container mx-auto px-4 py-8">
			<PlanHeader week={state.week} weekDates={weekDates} />

			<EditControls isEditMode={state.isEditMode} isLoading={state.isLoading} planActions={planActions} />

			<div className={state.isEditMode ? styles.editMode : ''}>
				<RecipeGrid
					recipes={state.recipes}
					allRecipes={allRecipes}
					isEditMode={state.isEditMode}
					isLoading={state.isLoading}
					recipeActions={recipeActions}
				/>
			</div>
		</main>
	);
}

export default function PlanClient({ week, year, weekDates, initialRecipes, allRecipes }: PlanClientProps) {
	return (
		<PlanProvider initialRecipes={initialRecipes} allRecipes={allRecipes} week={week} year={year} weekDates={weekDates}>
			<PlanContent />
		</PlanProvider>
	);
}
