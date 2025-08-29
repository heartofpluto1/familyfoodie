import { Metadata } from 'next';
import { getCurrentAndPlannedWeeks, getAllRecipesWithDetails, getCurrentWeek, getRecipesForRandomization } from '@/lib/queries/menus';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import withAuth from '@/app/components/withAuth';
import MultiWeekPlanClient from './plan-client-multiweek';
import { formatWeekDateRange } from '@/lib/utils/weekDates';
import { WeekPlan } from '@/types/plan';
import { Recipe } from '@/types/menus';

// Randomization logic with ingredient constraints (same as API)
function selectRandomRecipes(availableRecipes: Recipe[], count: number = 3): Recipe[] {
	const selected: Recipe[] = [];
	const usedPrimaryIngredients = new Set<string>();
	const usedSecondaryIngredients = new Set<string>();
	const availableCopy = [...availableRecipes];

	// Shuffle the available recipes
	for (let i = availableCopy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[availableCopy[i], availableCopy[j]] = [availableCopy[j], availableCopy[i]];
	}

	for (const recipe of availableCopy) {
		if (selected.length >= count) break;

		const ingredients = recipe.ingredients || [];
		if (ingredients.length === 0) continue;

		const primaryIngredient = ingredients[0];
		const secondaryIngredient = ingredients.length > 1 ? ingredients[1] : null;

		// Check constraints
		const primaryConflict = usedPrimaryIngredients.has(primaryIngredient);
		const secondaryConflict = secondaryIngredient && usedSecondaryIngredients.has(secondaryIngredient);

		if (!primaryConflict && !secondaryConflict) {
			selected.push(recipe);
			usedPrimaryIngredients.add(primaryIngredient);
			if (secondaryIngredient) {
				usedSecondaryIngredients.add(secondaryIngredient);
			}
		}
	}

	return selected;
}

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Plan Your Week',
		description: 'Plan your meals for the upcoming week with ease',
	};
}

async function PlanPage() {
	// Get session with household context
	const session = await getSession();
	if (!session || !session.household_id) {
		redirect('/login');
	}

	const plannedWeeks = await getCurrentAndPlannedWeeks(session.household_id);
	const allRecipes = await getAllRecipesWithDetails(session.household_id);
	const { week: currentWeek, year: currentYear } = getCurrentWeek();

	// Convert database results to WeekPlan format
	const weekPlans: WeekPlan[] = await Promise.all(
		plannedWeeks.map(async ({ week, year, recipes }) => {
			const isCurrentWeek = week === currentWeek && year === currentYear;
			const hasNoRecipes = !recipes || recipes.length === 0;

			// If this is the current week and it has no recipes, get randomized recipes and set to edit mode
			if (isCurrentWeek && hasNoRecipes) {
				const availableRecipes = await getRecipesForRandomization(session.household_id);
				const randomizedRecipes = selectRandomRecipes(availableRecipes, 3);

				return {
					week,
					year,
					weekDates: formatWeekDateRange(week, year),
					recipes: randomizedRecipes,
					initialRecipes: randomizedRecipes, // Pass recipes to display them
					initialEditMode: true, // Set to edit mode by default - cancel will use this to clear to empty
				};
			}

			return {
				week,
				year,
				weekDates: formatWeekDateRange(week, year),
				recipes: recipes || [],
				initialRecipes: recipes || [],
			};
		})
	);

	return <MultiWeekPlanClient initialWeeks={weekPlans} allRecipes={allRecipes} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default withAuth(PlanPage);
