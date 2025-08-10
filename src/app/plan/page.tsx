import { Metadata } from 'next';
import { getNextWeekRecipes, getNextWeek, getAllRecipesWithDetails } from '@/lib/queries/menus';
import withAuth from '@/app/components/withAuth';
import PlanClient from './plan-client';
import { formatWeekDateRange } from '@/lib/utils/weekDates';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Plan Your Week',
		description: 'Plan your meals for the upcoming week with ease',
	};
}

async function PlanPage() {
	const nextWeek = getNextWeek();
	const nextWeekRecipes = await getNextWeekRecipes();
	const allRecipes = await getAllRecipesWithDetails();

	const weekDateRange = formatWeekDateRange(nextWeek.week, nextWeek.year);

	return <PlanClient week={nextWeek.week} year={nextWeek.year} weekDates={weekDateRange} initialRecipes={nextWeekRecipes} allRecipes={allRecipes} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(PlanPage);
