import { Metadata } from 'next';
import { getNextWeekRecipes, getNextWeek, getAllRecipesWithDetails } from '@/lib/queries/menus';
import withAuth from '../components/withAuth';
import PlanClient from './plan-client';

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

	// Calculate week dates
	const startDate = new Date(nextWeek.year, 0, 1 + (nextWeek.week - 1) * 7);
	const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);

	const formatDate = (date: Date) => {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
		});
	};

	return (
		<PlanClient
			week={nextWeek.week}
			year={nextWeek.year}
			weekDates={`${formatDate(startDate)} → ${formatDate(endDate)}`}
			initialRecipes={nextWeekRecipes}
			allRecipes={allRecipes}
		/>
	);
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(PlanPage);
