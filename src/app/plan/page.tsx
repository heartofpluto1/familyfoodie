import { Metadata } from 'next';
import { getCurrentAndPlannedWeeks, getAllRecipesWithDetails } from '@/lib/queries/menus';
import withAuth from '@/app/components/withAuth';
import MultiWeekPlanClient from './plan-client-multiweek';
import { formatWeekDateRange } from '@/lib/utils/weekDates';
import { WeekPlan } from '@/types/plan';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Plan Your Week',
		description: 'Plan your meals for the upcoming week with ease',
	};
}

async function PlanPage() {
	const plannedWeeks = await getCurrentAndPlannedWeeks();
	const allRecipes = await getAllRecipesWithDetails();

	// Convert database results to WeekPlan format
	const weekPlans: WeekPlan[] = plannedWeeks.map(({ week, year, recipes }) => ({
		week,
		year,
		weekDates: formatWeekDateRange(week, year),
		recipes: recipes || [],
		initialRecipes: recipes || [],
	}));

	return <MultiWeekPlanClient initialWeeks={weekPlans} allRecipes={allRecipes} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(PlanPage);
