import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import HomeAuthenticated from './home/home-authenticated';
import HomeUnauthenticated from './home/home-unauthenticated';
import { getRecipeWeeks } from '@/lib/queries/menus';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Family Foodie - Meal Planning Dashboard',
		description: 'Your personalized meal planning dashboard with weekly stats and meal history',
	};
}

export default async function HomePage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		return <HomeUnauthenticated />;
	}

	// Fetch data for authenticated users - using existing getRecipeWeeks function
	const { household_id, household_name } = session.user;
	const { data: plans, stats } = await getRecipeWeeks(household_id, 6);

	return <HomeAuthenticated plans={plans || []} stats={stats || { totalWeeks: 0, totalRecipes: 0, avgRecipesPerWeek: 0 }} householdName={household_name} />;
}
