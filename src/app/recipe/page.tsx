import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import RecipesPageClient from './recipes-client';
import { getAllRecipesWithDetails } from '@/lib/queries/menus';
import { getCollectionsForDisplay, getCollectionById } from '@/lib/queries/collections';
import { generateSlugPath, generateSlugFromTitle } from '@/lib/utils/urlHelpers';
import withAuth from '@/app/components/withAuth';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: `List all recipes`,
		description: 'List of all recipes available in the system',
	};
}

interface RecipesPageProps {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function RecipesPage({ searchParams }: RecipesPageProps) {
	const params = await searchParams;
	const collectionId = params.collection ? parseInt(params.collection as string) : undefined;

	// Redirect old query param URLs to new slug format
	if (collectionId) {
		const collection = await getCollectionById(collectionId);
		if (collection) {
			const slug = collection.url_slug ? generateSlugPath(collection.id, collection.url_slug) : generateSlugFromTitle(collection.id, collection.title);
			redirect(`/recipes/${slug}`);
		}
	}

	// No collection specified, show all recipes
	const [recipes, collections] = await Promise.all([getAllRecipesWithDetails(), getCollectionsForDisplay()]);

	return (
		<main className="container mx-auto px-4 py-8">
			<RecipesPageClient recipes={recipes} collections={collections} selectedCollection={null} />
		</main>
	);
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipesPage);
