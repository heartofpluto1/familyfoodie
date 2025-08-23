import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import CollectionRecipesClient from './collection-recipes-client';
import { getAllRecipesWithDetails } from '@/lib/queries/menus';
import { getCollectionById } from '@/lib/queries/collections';
import { parseSlugPath, generateSlugPath, generateSlugFromTitle } from '@/lib/utils/urlHelpers';
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

	const [recipes, collection] = await Promise.all([getAllRecipesWithDetails(parsed.id), getCollectionById(parsed.id)]);

	// If collection not found, show 404
	if (!collection) {
		notFound();
	}

	// Optional: Redirect if slug doesn't match current url_slug (for SEO consistency)
	const currentSlug = collection.url_slug ? generateSlugPath(collection.id, collection.url_slug) : generateSlugFromTitle(collection.id, collection.title);
	if (slug !== currentSlug) {
		redirect(`/recipes/${currentSlug}`);
	}

	return (
		<main className="container mx-auto px-4 py-8">
			<CollectionRecipesClient recipes={recipes} collection={collection} />
		</main>
	);
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipesPage);
