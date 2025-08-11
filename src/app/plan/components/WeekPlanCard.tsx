import React from 'react';
import { Recipe } from '@/types/menus';
import { WeekPlan } from '@/types/plan';
import { PlanProvider, usePlanContext } from '../contexts/PlanProvider';
import { PlanHeader } from './PlanHeader';
import { EditControls } from './EditControls';
import { RecipeGrid } from './RecipeGrid';
import { createWeekId } from '../utils/weekUtils';
import styles from '../plan.module.css';

interface WeekPlanCardProps {
	weekPlan: WeekPlan;
	allRecipes: Recipe[];
	onUpdateRecipes: (weekId: string, recipes: Recipe[]) => void;
	onWeekDelete?: () => void;
}

function WeekPlanContent({ weekPlan }: { weekPlan: WeekPlan }) {
	const { state, planActions, recipeActions, allRecipes, weekDates } = usePlanContext();

	return (
		<div className="mb-12">
			<div className="flex justify-between items-start mb-6">
				<PlanHeader week={state.week} weekDates={weekDates} />
			</div>

			<EditControls isEditMode={state.isEditMode} isLoading={state.isLoading} planActions={planActions} week={weekPlan.week} year={weekPlan.year} />

			<div className={state.isEditMode ? styles.editMode : ''}>
				<RecipeGrid
					recipes={state.recipes}
					allRecipes={allRecipes}
					isEditMode={state.isEditMode}
					isLoading={state.isLoading}
					recipeActions={recipeActions}
				/>
			</div>
		</div>
	);
}

export function WeekPlanCard({ weekPlan, allRecipes, onUpdateRecipes, onWeekDelete }: WeekPlanCardProps) {
	return (
		<PlanProvider
			initialRecipes={weekPlan.initialRecipes}
			allRecipes={allRecipes}
			week={weekPlan.week}
			year={weekPlan.year}
			weekDates={weekPlan.weekDates}
			onRecipesChange={recipes => onUpdateRecipes(createWeekId(weekPlan.week, weekPlan.year), recipes)}
			initialEditMode={weekPlan.initialEditMode}
			onWeekDelete={onWeekDelete}
		>
			<WeekPlanContent weekPlan={weekPlan} />
		</PlanProvider>
	);
}
