import { Metadata } from 'next';
import { getRecipeWeeks } from '@/lib/queries/menus';
import { getSession } from '@/lib/session';
import HomeAuthenticated from './home/home-authenticated';
import HomeUnauthenticated from './home/home-unauthenticated';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Family Foodie - Meal Planning Dashboard',
		description: 'Your personalized meal planning dashboard with weekly stats and meal history',
	};
}

export default async function HomePage() {
	// Check authentication status server-side
	const session = await getSession();

	if (!session) {
		// User is not authenticated - show marketing/login page
		return <HomeUnauthenticated />;
	}

	// User is authenticated - fetch data and show dashboard
	const { data: plans, stats } = await getRecipeWeeks(6);
	return <HomeAuthenticated plans={plans || []} stats={stats || { totalWeeks: 0, totalRecipes: 0, avgRecipesPerWeek: 0 }} />;
}

// Force dynamic rendering for authenticated/unauthenticated check
export const dynamic = 'force-dynamic';
