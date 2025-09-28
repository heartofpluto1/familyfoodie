import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import CollectionClient from './collection-client';
import { getAllRecipesWithDetailsHousehold } from '@/lib/queries/menus';
import { getOwnedCollections, getCollectionByIdWithHousehold } from '@/lib/queries/collections';
import { parseSlugPath } from '@/lib/utils/urlHelpers';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export async function generateMetadata({ params }: { params: Promise<{ 'collection-slug': string }> }): Promise<Metadata> {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	if (!parsed) {
		return {
			title: 'Collection Not Found',
			description: 'The requested collection could not be found',
		};
	}

	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}
	const household_id = session.user.household_id;
	const collection = await getCollectionByIdWithHousehold(parsed.id, household_id);
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

export default async function RecipesPage({ params }: RecipesPageProps) {
	const { 'collection-slug': slug } = await params;
	const parsed = parseSlugPath(slug);

	// If URL format is invalid, redirect to main recipes page
	if (!parsed) {
		redirect('/recipes');
	}

	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}
	const household_id = session.user.household_id;

	const [recipes, collections, selectedCollection] = await Promise.all([
		getAllRecipesWithDetailsHousehold(household_id, parsed.id),
		getOwnedCollections(household_id),
		getCollectionByIdWithHousehold(parsed.id, household_id),
	]);

	// If collection not found or user doesn't have access, show 404
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
