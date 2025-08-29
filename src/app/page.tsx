import { Metadata } from 'next';
import { getRecipeWeeks, getAllRecipesWithDetailsHousehold } from '@/lib/queries/menus';
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

	// Get household_id from session
	const household_id = session.household_id;

	if (!household_id) {
		// Session exists but no household_id - show error or redirect to login
		return <HomeUnauthenticated />;
	}

	// User is authenticated - fetch data and show dashboard
	const { data: plans, stats } = await getRecipeWeeks(household_id, 6);

	// If user has less than 2 plans, fetch sample recipes for demo
	let sampleRecipes = undefined;
	if ((plans?.length || 0) < 2) {
		try {
			const allRecipes = await getAllRecipesWithDetailsHousehold(household_id);
			// Get up to 4 recipes with good images and timing data for demo
			sampleRecipes = allRecipes.filter(recipe => recipe.image_filename && (recipe.prepTime || recipe.cookTime)).slice(0, 4);
		} catch (error) {
			console.error('Error fetching sample recipes:', error);
		}
	}

	return (
		<HomeAuthenticated
			plans={plans || []}
			stats={stats || { totalWeeks: 0, totalRecipes: 0, avgRecipesPerWeek: 0 }}
			householdName={session.household_name}
			sampleRecipes={sampleRecipes}
		/>
	);
}

// Force dynamic rendering for authenticated/unauthenticated check
export const dynamic = 'force-dynamic';
