import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getRecipeDetails } from '@/lib/queries/menus';
import { getCollectionsForDisplay } from '@/lib/queries/collections';
import { parseRecipeUrl } from '@/lib/utils/urlHelpers';
import withAuth from '@/app/components/withAuth';
import RecipeDetailsClient from './recipe-details-client';

interface PageProps {
	params: Promise<{ 'collection-slug': string; 'recipe-slug': string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { 'collection-slug': collectionSlug, 'recipe-slug': recipeSlug } = await params;
	const parsed = parseRecipeUrl(collectionSlug, recipeSlug);

	if (!parsed) {
		return {
			title: 'Recipe Not Found',
			description: 'The requested recipe could not be found',
		};
	}

	const recipe = await getRecipeDetails(parsed.recipeId.toString());

	return {
		title: recipe ? `${recipe.name} - Recipe Details` : 'Recipe Not Found',
		description: recipe ? recipe.description : 'Recipe details not available',
	};
}

async function RecipeDetailsPage({ params }: PageProps) {
	const { 'collection-slug': collectionSlug, 'recipe-slug': recipeSlug } = await params;
	const parsed = parseRecipeUrl(collectionSlug, recipeSlug);

	// If URL format is invalid, show 404
	if (!parsed) {
		notFound();
	}

	const [recipe, collections] = await Promise.all([getRecipeDetails(parsed.recipeId.toString()), getCollectionsForDisplay()]);

	if (!recipe) {
		notFound();
	}

	// Validate that recipe belongs to the specified collection
	if (recipe.collection_id !== parsed.collectionId) {
		// Recipe exists but doesn't belong to this collection - redirect to correct collection
		redirect(`/recipes/${recipe.collection_url_slug}/${recipe.url_slug}`);
	}

	// Optional: Redirect if slugs don't match current url_slugs (for SEO consistency)
	if (collectionSlug !== recipe.collection_url_slug || recipeSlug !== recipe.url_slug) {
		redirect(`/recipes/${recipe.collection_url_slug}/${recipe.url_slug}`);
	}

	return <RecipeDetailsClient recipe={recipe} collections={collections} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipeDetailsPage);
