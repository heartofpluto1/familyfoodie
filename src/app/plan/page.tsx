import { Metadata } from 'next';
import { getCurrentAndPlannedWeeks, getAllRecipesWithDetails } from '@/lib/queries/menus';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
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
	// Get session with household context
	const session = await getSession();
	if (!session || !session.household_id) {
		redirect('/login');
	}

	const plannedWeeks = await getCurrentAndPlannedWeeks(session.household_id);
	const allRecipes = await getAllRecipesWithDetails(session.household_id);

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
export const revalidate = 0;
export default withAuth(PlanPage);
