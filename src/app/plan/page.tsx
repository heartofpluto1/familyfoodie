import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getCurrentAndPlannedWeeks, getAllRecipesWithDetailsHousehold, getCurrentWeek } from '@/lib/queries/menus';
import MultiWeekPlanClient from './plan-client-multiweek';
import { formatWeekDateRange } from '@/lib/utils/weekDates';
import { WeekPlan } from '@/types/plan';
import { selectRandomRecipes } from './utils/randomizeRecipes';

export const dynamic = 'force-dynamic'; // Important for authenticated pages
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Plan Your Week',
		description: 'Plan your meals for the upcoming week with ease',
	};
}

export default async function PlanPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}
	const household_id = session.user.household_id;

	const plannedWeeks = await getCurrentAndPlannedWeeks(household_id);
	const allRecipes = await getAllRecipesWithDetailsHousehold(household_id);
	const { week: currentWeek, year: currentYear } = getCurrentWeek();

	// Convert database results to WeekPlan format
	const weekPlans: WeekPlan[] = await Promise.all(
		plannedWeeks.map(async ({ week, year, recipes }) => {
			const isCurrentWeek = week === currentWeek && year === currentYear;
			const hasNoRecipes = !recipes || recipes.length === 0;

			// If this is the current week and it has no recipes, get randomized recipes and set to edit mode
			if (isCurrentWeek && hasNoRecipes) {
				const randomizedRecipes = selectRandomRecipes(allRecipes, new Set(), 3);

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
