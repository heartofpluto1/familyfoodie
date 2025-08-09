import { Metadata } from 'next';
import RecipesPageClient from './recipes-client';
import { getAllRecipesWithDetails } from '@/lib/queries/menus';
import withAuth from '../components/withAuth';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: `List all recipes`,
		description: 'List of all recipes available in the system',
	};
}

async function RecipesPage() {
	const recipes = await getAllRecipesWithDetails();
	return (
		<main className="container mx-auto px-4 py-8">
			<RecipesPageClient recipes={recipes} />
		</main>
	);
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipesPage);
