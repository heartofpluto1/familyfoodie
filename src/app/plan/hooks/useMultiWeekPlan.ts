import { useState } from 'react';
import { Recipe } from '@/types/menus';
import { WeekPlan, MultiWeekPlanState } from '@/types/plan';
import { getNextWeek, createWeekId } from '../utils/weekUtils';
import { selectRandomRecipes } from '../utils/randomizeRecipes';

interface UseMultiWeekPlanProps {
	initialWeeks: WeekPlan[];
	allRecipes: Recipe[];
}

export function useMultiWeekPlan({ initialWeeks, allRecipes }: UseMultiWeekPlanProps) {
	const [multiWeekState, setMultiWeekState] = useState<MultiWeekPlanState>({
		weeks: initialWeeks,
		allRecipes,
	});

	// Calculate the next unplanned week number
	const getNextUnplannedWeek = () => {
		if (multiWeekState.weeks.length === 0) return undefined;

		const lastWeek = multiWeekState.weeks[multiWeekState.weeks.length - 1];
		const nextWeekInfo = getNextWeek(lastWeek.week, lastWeek.year);

		// Keep checking subsequent weeks until we find one that doesn't exist
		let checkWeek = nextWeekInfo.week;
		let checkYear = nextWeekInfo.year;

		while (multiWeekState.weeks.some(w => w.week === checkWeek && w.year === checkYear)) {
			const nextCheck = getNextWeek(checkWeek, checkYear);
			checkWeek = nextCheck.week;
			checkYear = nextCheck.year;
		}

		return checkWeek;
	};

	const addNextWeek = async () => {
		const lastWeek = multiWeekState.weeks[multiWeekState.weeks.length - 1];
		const nextWeekInfo = getNextWeek(lastWeek.week, lastWeek.year);

		// Check if this week already exists
		const weekExists = multiWeekState.weeks.some(w => w.week === nextWeekInfo.week && w.year === nextWeekInfo.year);

		if (weekExists) {
			return;
		}

		// Get automated recipe suggestions
		const suggestedRecipes = selectRandomRecipes(multiWeekState.allRecipes, new Set(), 3);

		// Create new week with automated recipes and set to edit mode
		const newWeek: WeekPlan = {
			week: nextWeekInfo.week,
			year: nextWeekInfo.year,
			weekDates: nextWeekInfo.weekDates,
			recipes: suggestedRecipes,
			initialRecipes: [], // Keep empty so user can cancel back to empty state
			initialEditMode: true,
		};

		setMultiWeekState(prev => ({
			...prev,
			weeks: [...prev.weeks, newWeek],
		}));
	};

	const removeWeek = (weekId: string) => {
		setMultiWeekState(prev => ({
			...prev,
			weeks: prev.weeks.filter(w => createWeekId(w.week, w.year) !== weekId),
		}));
	};

	const updateWeekRecipes = (weekId: string, recipes: Recipe[]) => {
		setMultiWeekState(prev => ({
			...prev,
			weeks: prev.weeks.map(w => (createWeekId(w.week, w.year) === weekId ? { ...w, recipes, initialRecipes: recipes } : w)),
		}));
	};

	return {
		multiWeekState,
		addNextWeek,
		removeWeek,
		updateWeekRecipes,
		nextWeekNumber: getNextUnplannedWeek(),
	};
}
