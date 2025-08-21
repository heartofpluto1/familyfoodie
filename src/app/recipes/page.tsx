import { Metadata } from 'next';
import CollectionsPageClient from './collections-client';
import { getCollectionsForDisplay } from '@/lib/queries/collections';
import withAuth from '@/app/components/withAuth';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: 'Recipe Collections',
		description: 'Browse recipes organized by collection',
	};
}

async function RecipesPage() {
	const collections = await getCollectionsForDisplay();

	return (
		<main className="container mx-auto px-4 py-8">
			<CollectionsPageClient collections={collections} />
		</main>
	);
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipesPage);
