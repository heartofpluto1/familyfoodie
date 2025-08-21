import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getRecipeDetails } from '@/lib/queries/menus';
import { getAllCollections } from '@/lib/queries/collections';
import { parseRecipeUrl, generateSlugPath, generateSlugFromTitle } from '@/lib/utils/urlHelpers';
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

	const [recipe, collections] = await Promise.all([getRecipeDetails(parsed.recipeId.toString()), getAllCollections()]);

	if (!recipe) {
		notFound();
	}

	// Validate that recipe belongs to the specified collection
	if (recipe.collection_id !== parsed.collectionId) {
		// Recipe exists but doesn't belong to this collection - redirect to correct collection
		const correctCollectionSlug = recipe.collection_url_slug
			? generateSlugPath(recipe.collection_id, recipe.collection_url_slug)
			: generateSlugFromTitle(recipe.collection_id, recipe.collection_title);
		const correctRecipeSlug = recipe.url_slug ? generateSlugPath(recipe.id, recipe.url_slug) : generateSlugFromTitle(recipe.id, recipe.name);
		redirect(`/recipes/${correctCollectionSlug}/${correctRecipeSlug}`);
	}

	// Optional: Redirect if slugs don't match current url_slugs (for SEO consistency)
	const currentCollectionSlug = recipe.collection_url_slug
		? generateSlugPath(recipe.collection_id, recipe.collection_url_slug)
		: generateSlugFromTitle(recipe.collection_id, recipe.collection_title);
	const currentRecipeSlug = recipe.url_slug ? generateSlugPath(recipe.id, recipe.url_slug) : generateSlugFromTitle(recipe.id, recipe.name);
	if (collectionSlug !== currentCollectionSlug || recipeSlug !== currentRecipeSlug) {
		redirect(`/recipes/${currentCollectionSlug}/${currentRecipeSlug}`);
	}

	return <RecipeDetailsClient recipe={recipe} collections={collections} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipeDetailsPage);
