import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import CollectionsPageClient from './collections-client';
import { getMyCollections, getPublicCollections } from '@/lib/queries/collections';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Recipe Collections',
		description: 'Browse recipes organized by collection',
	};
}

export default async function RecipesPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}

	const household_id = session.user.household_id;

	// Server-side data fetching - runs in parallel
	const [myCollections, publicCollections] = await Promise.all([
		getMyCollections(household_id), // Household's owned and subscribed collections
		getPublicCollections(household_id), // Browsable public collections
	]);

	return (
		<main className="container mx-auto px-4 py-8">
			<CollectionsPageClient myCollections={myCollections} publicCollections={publicCollections} />
		</main>
	);
}
