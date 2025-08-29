import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getRecipeDetailsHousehold } from '@/lib/queries/menus';
import { getCollectionsForDisplay } from '@/lib/queries/collections';
import { parseRecipeUrl } from '@/lib/utils/urlHelpers';
import { getSession } from '@/lib/session';
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

	// Get session for household context
	const session = await getSession();
	if (!session || !session.household_id) {
		return {
			title: 'Recipe Not Found',
			description: 'The requested recipe could not be found',
		};
	}

	const recipe = await getRecipeDetailsHousehold(parsed.recipeId.toString(), session.household_id);

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

	// Get session for household context
	const session = await getSession();
	if (!session || !session.household_id) {
		redirect('/login');
	}

	const [recipe, collections] = await Promise.all([getRecipeDetailsHousehold(parsed.recipeId.toString(), session.household_id), getCollectionsForDisplay()]);

	// If recipe not found or user doesn't have access, show 404
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
