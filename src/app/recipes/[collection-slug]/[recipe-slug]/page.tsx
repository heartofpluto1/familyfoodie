import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getRecipeDetailsHousehold } from '@/lib/queries/menus';
import { getCollectionsForDisplay } from '@/lib/queries/collections';
import { parseRecipeUrl } from '@/lib/utils/urlHelpers';
import { getSession } from '@/lib/session';
import withAuth from '@/app/components/withAuth';
import RecipeDetailsClient from './recipe-details-client';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';

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

	// Check if the recipe exists in the requested collection AND user has access to the collection
	// A user has access if they: own it, are subscribed to it, or it's public
	const [checkResult] = await pool.execute<RowDataPacket[]>(
		`SELECT 1 
		FROM collection_recipes cr
		INNER JOIN collections c ON cr.collection_id = c.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE cr.recipe_id = ? 
		AND cr.collection_id = ?
		AND (
			c.household_id = ? OR           -- User owns collection
			cs.household_id IS NOT NULL OR  -- User subscribed to collection  
			c.public = 1                    -- Public collection
		)`,
		[session.household_id, parsed.recipeId, parsed.collectionId, session.household_id]
	);

	if (checkResult.length === 0) {
		// Recipe doesn't exist in this collection OR user doesn't have access - show 404
		notFound();
	}

	// Update the recipe object to use the current collection context (not its original collection)
	// This is important for the delete functionality to work correctly
	const recipeWithCurrentCollection = {
		...recipe,
		collection_id: parsed.collectionId,
		collection_url_slug: collectionSlug,
	};

	return <RecipeDetailsClient recipe={recipeWithCurrentCollection} collections={collections} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipeDetailsPage);
