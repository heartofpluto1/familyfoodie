import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CollectionsPageClient from './collections-client';
import { getMyCollections, getPublicCollections } from '@/lib/queries/collections';
import { getSession } from '@/lib/session';
import withAuth from '@/app/components/withAuth';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Recipe Collections',
		description: 'Browse recipes organized by collection',
	};
}

async function RecipesPage() {
	// Get user session for household context
	const session = await getSession();
	if (!session || !session.household_id) {
		redirect('/login');
	}

	// Server-side data fetching - runs in parallel
	const [myCollections, publicCollections] = await Promise.all([
		getMyCollections(session.household_id), // Household's owned and subscribed collections
		getPublicCollections(session.household_id), // Browsable public collections
	]);

	return (
		<main className="container mx-auto px-4 py-8">
			<CollectionsPageClient myCollections={myCollections} publicCollections={publicCollections} />
		</main>
	);
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipesPage);
