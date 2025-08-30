import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getRecipeDetailsHousehold } from '@/lib/queries/menus';
import { getCollectionsForDisplay } from '@/lib/queries/collections';
import { parseRecipeUrl } from '@/lib/utils/urlHelpers';
import RecipeDetailsClient from './recipe-details-client';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';

interface PageProps {
	params: Promise<{ 'collection-slug': string; 'recipe-slug': string }>;
}

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}

	const household_id = session.user.household_id;
	const { 'collection-slug': collectionSlug, 'recipe-slug': recipeSlug } = await params;
	const parsed = parseRecipeUrl(collectionSlug, recipeSlug);

	if (!parsed) {
		return {
			title: 'Recipe Not Found',
			description: 'The requested recipe could not be found',
		};
	}

	const recipe = await getRecipeDetailsHousehold(parsed.recipeId.toString(), household_id);

	return {
		title: recipe ? `${recipe.name} - Recipe Details` : 'Recipe Not Found',
		description: recipe ? recipe.description : 'Recipe details not available',
	};
}

export default async function RecipeDetailsPage({ params }: PageProps) {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}

	const household_id = session.user.household_id;
	const { 'collection-slug': collectionSlug, 'recipe-slug': recipeSlug } = await params;
	const parsed = parseRecipeUrl(collectionSlug, recipeSlug);

	// If URL format is invalid, show 404
	if (!parsed) {
		notFound();
	}

	const [recipe, collections] = await Promise.all([getRecipeDetailsHousehold(parsed.recipeId.toString(), household_id), getCollectionsForDisplay()]);

	// If recipe not found or user doesn't have access, show 404
	if (!recipe) {
		notFound();
	}

	// Check if the recipe exists in the requested collection AND user has access to the collection
	// A user has access if they: own it, are subscribed to it, or it's public
	// Also determine if the user owns the collection
	const [checkResult] = await pool.execute<RowDataPacket[]>(
		`SELECT 
			CASE 
				WHEN c.household_id = ? THEN 'owned'
				WHEN cs.household_id IS NOT NULL THEN 'subscribed'
				WHEN c.public = 1 THEN 'public'
				ELSE NULL
			END as access_type
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
		[household_id, household_id, parsed.recipeId, parsed.collectionId, household_id]
	);

	if (checkResult.length === 0) {
		// Recipe doesn't exist in this collection OR user doesn't have access - show 404
		notFound();
	}

	const accessType = checkResult[0].access_type;
	const isOwned = accessType === 'owned';

	// Update the recipe object to use the current collection context (not its original collection)
	// This is important for the delete functionality to work correctly
	const recipeWithCurrentCollection = {
		...recipe,
		collection_id: parsed.collectionId,
		collection_url_slug: collectionSlug,
	};

	return <RecipeDetailsClient recipe={recipeWithCurrentCollection} collections={collections} isOwned={isOwned} />;
}
