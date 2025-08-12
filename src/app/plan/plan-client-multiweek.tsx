'use client';

import React, { useState } from 'react';
import { Recipe } from '@/types/menus';
import { WeekPlan } from '@/types/plan';
import { useMultiWeekPlan } from './hooks/useMultiWeekPlan';
import { AddWeekButton } from './components/AddWeekButton';
import { WeekPlanCard } from './components/WeekPlanCard';
import { createWeekId } from './utils/weekUtils';

interface MultiWeekPlanClientProps {
	initialWeeks: WeekPlan[];
	allRecipes: Recipe[];
}

export default function MultiWeekPlanClient({ initialWeeks, allRecipes }: MultiWeekPlanClientProps) {
	const [isAddingWeek, setIsAddingWeek] = useState(false);

	const { multiWeekState, addNextWeek, removeWeek, updateWeekRecipes, nextWeekNumber } = useMultiWeekPlan({
		initialWeeks,
		allRecipes,
	});

	const handleAddWeek = async () => {
		setIsAddingWeek(true);
		try {
			await addNextWeek();
		} finally {
			setIsAddingWeek(false);
		}
	};

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Render each week */}
			{multiWeekState.weeks.map((week, index) => (
				<React.Fragment key={`${week.year}-W${week.week}`}>
					<WeekPlanCard
						weekPlan={week}
						allRecipes={allRecipes}
						onUpdateRecipes={updateWeekRecipes}
						onWeekDelete={() => removeWeek(createWeekId(week.week, week.year))}
					/>
					{index < multiWeekState.weeks.length && <hr className="border-t border-gray-300 dark:border-gray-600 mb-10" />}
				</React.Fragment>
			))}

			{/* Add next week button */}
			<AddWeekButton onAddWeek={handleAddWeek} isLoading={isAddingWeek} nextWeekNumber={nextWeekNumber} />
		</div>
	);
}
