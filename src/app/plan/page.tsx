import { Metadata } from 'next';
import { getCurrentAndPlannedWeeks, getAllRecipesWithDetails } from '@/lib/queries/menus';
import { getEncryptedSession, decrypt } from '@/lib/session';
import { validateSessionWithHousehold } from '@/lib/auth';
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
	// Get user's household context
	const sessionCookie = await getEncryptedSession();
	if (!sessionCookie) {
		redirect('/login');
	}

	const sessionData = decrypt(sessionCookie);
	const session = JSON.parse(sessionData);

	const user = await validateSessionWithHousehold(session.id);
	if (!user) {
		redirect('/login');
	}

	const plannedWeeks = await getCurrentAndPlannedWeeks(user.household_id);
	const allRecipes = await getAllRecipesWithDetails(user.household_id);

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
