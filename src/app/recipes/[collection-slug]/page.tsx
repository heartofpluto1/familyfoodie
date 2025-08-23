import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import CollectionClient from './collection-client';
import { getAllRecipesWithDetails } from '@/lib/queries/menus';
import { getCollectionsForDisplay, getCollectionById } from '@/lib/queries/collections';
import { parseSlugPath } from '@/lib/utils/urlHelpers';
import withAuth from '@/app/components/withAuth';

export async function generateMetadata({ params }: { params: Promise<{ 'collection-slug': string }> }): Promise<Metadata> {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	if (!parsed) {
		return {
			title: 'Collection Not Found',
			description: 'The requested collection could not be found',
		};
	}

	const collection = await getCollectionById(parsed.id);
	if (!collection) {
		return {
			title: 'Collection Not Found',
			description: 'The requested collection could not be found',
		};
	}

	return {
		title: `${collection.title} Recipes`,
		description: collection.subtitle || `Browse recipes from the ${collection.title} collection`,
	};
}

interface RecipesPageProps {
	params: Promise<{ 'collection-slug': string }>;
}

async function RecipesPage({ params }: RecipesPageProps) {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	// If URL format is invalid, redirect to main recipes page
	if (!parsed) {
		redirect('/recipes');
	}

	const [recipes, collections, selectedCollection] = await Promise.all([
		getAllRecipesWithDetails(parsed.id),
		getCollectionsForDisplay(),
		getCollectionById(parsed.id),
	]);

	// If collection not found, show 404
	if (!selectedCollection) {
		notFound();
	}

	// Optional: Redirect if slug doesn't match current url_slug (for SEO consistency)
	if (slug !== selectedCollection.url_slug) {
		redirect(`/recipes/${selectedCollection.url_slug}`);
	}

	return (
		<main className="container mx-auto px-4 py-8">
			<CollectionClient recipes={recipes} collections={collections} selectedCollection={selectedCollection} />
		</main>
	);
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipesPage);
