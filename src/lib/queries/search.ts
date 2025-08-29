import pool from '@/lib/db.js';
import type { CollectionSearchResult, IngredientSearchResult } from '@/types/database';
import { Recipe } from '@/types/menus.js';

/**
 * Advanced search functionality with household precedence
 * Implements multi-field search with household-scoped access
 */

/**
 * Search recipes with household precedence logic
 * Prioritizes household-owned recipes over subscribed/public ones
 * @param searchTerm - The search term to match against recipe fields
 * @param household_id - The household performing the search
 * @param collectionId - Optional collection filter
 * @returns Array of recipes matching search criteria with household precedence
 */
export async function searchRecipesWithPrecedence(searchTerm: string, household_id: number, collectionId?: number): Promise<Recipe[]> {
	// Multi-field search with household + subscribed precedence
	let query = `
		SELECT DISTINCT r.*, 
		       CASE WHEN r.household_id = ? THEN 'customized'
		            WHEN EXISTS (SELECT 1 FROM collections c WHERE c.id = cr.collection_id AND c.household_id = r.household_id) THEN 'original'
		            ELSE 'referenced' END as status,
		       GROUP_CONCAT(DISTINCT c.title ORDER BY c.title SEPARATOR ', ') as collections,
		       r.household_id = ? as can_edit,
		       s.name as seasonName
		FROM recipes r
		LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
		LEFT JOIN collections c ON cr.collection_id = c.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		LEFT JOIN seasons s ON r.season_id = s.id
		LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
		LEFT JOIN ingredients i ON ri.ingredient_id = i.id
		WHERE (
		  r.household_id = ? OR  -- Household's own recipes
		  c.public = 1 OR        -- Recipes in public collections  
		  cs.household_id IS NOT NULL  -- Recipes in subscribed collections
		)
		AND NOT EXISTS (
		  SELECT 1 FROM recipes r2 
		  WHERE r2.household_id = ? 
		  AND r2.parent_id = r.id
		  AND r.household_id != ?
		)
		AND (
		  LOWER(r.name) LIKE LOWER(?) OR
		  LOWER(r.description) LIKE LOWER(?) OR
		  LOWER(s.name) LIKE LOWER(?) OR
		  LOWER(i.name) LIKE LOWER(?)
		)
	`;

	const searchPattern = `%${searchTerm}%`;
	const params = [
		household_id,
		household_id,
		household_id,
		household_id,
		household_id,
		household_id,
		searchPattern,
		searchPattern,
		searchPattern,
		searchPattern,
	];

	if (collectionId) {
		query += ` AND cr.collection_id = ?`;
		params.push(collectionId);
	}

	query += ` GROUP BY r.id ORDER BY status ASC, r.name ASC`;

	const [rows] = await pool.execute(query, params);
	return rows as Recipe[];
}

/**
 * Search collections with household access filtering
 * @param searchTerm - The search term to match against collection fields
 * @param household_id - The household performing the search
 * @param accessType - Filter by access type ('owned', 'subscribed', 'public', 'all')
 * @returns Array of collections matching search criteria
 */
export async function searchCollectionsWithAccess(
	searchTerm: string,
	household_id: number,
	accessType: 'owned' | 'subscribed' | 'public' | 'all' = 'all'
): Promise<CollectionSearchResult[]> {
	let whereClause = '';
	const params: (number | string)[] = [household_id, household_id, household_id];

	switch (accessType) {
		case 'owned':
			whereClause = 'AND c.household_id = ?';
			params.push(household_id);
			break;
		case 'subscribed':
			whereClause = 'AND cs.household_id IS NOT NULL AND c.household_id != ?';
			params.push(household_id);
			break;
		case 'public':
			whereClause = 'AND c.public = 1 AND c.household_id != ? AND cs.household_id IS NULL';
			params.push(household_id);
			break;
		case 'all':
		default:
			whereClause = `
				AND (
				  c.household_id = ? OR
				  cs.household_id IS NOT NULL OR
				  c.public = 1
				)
			`;
			params.push(household_id);
			break;
	}

	const searchPattern = `%${searchTerm}%`;
	const query = `
		SELECT c.*, h.name as owner_name,
		       CASE 
		         WHEN c.household_id = ? THEN 'owned'
		         WHEN cs.household_id IS NOT NULL THEN 'subscribed' 
		         WHEN c.public = 1 THEN 'public'
		         ELSE NULL 
		       END as access_type,
		       COUNT(cr.recipe_id) as recipe_count,
		       c.household_id = ? as can_edit,
		       (c.public = 1 AND c.household_id != ? AND cs.household_id IS NULL) as can_subscribe
		FROM collections c
		JOIN households h ON c.household_id = h.id
		LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE (
		  LOWER(c.title) LIKE LOWER(?) OR
		  LOWER(c.subtitle) LIKE LOWER(?) OR
		  LOWER(h.name) LIKE LOWER(?)
		)
		${whereClause}
		GROUP BY c.id
		ORDER BY access_type ASC, c.title ASC
	`;

	params.push(searchPattern, searchPattern, searchPattern);

	const [rows] = await pool.execute(query, params);
	return rows as CollectionSearchResult[];
}

/**
 * Search ingredients with household precedence
 * @param searchTerm - The search term to match against ingredient fields
 * @param household_id - The household performing the search
 * @returns Array of ingredients matching search criteria with household precedence
 */
export async function searchIngredientsWithPrecedence(searchTerm: string, household_id: number): Promise<IngredientSearchResult[]> {
	const searchPattern = `%${searchTerm}%`;
	const query = `
		SELECT DISTINCT i.*,
		       CASE WHEN i.household_id = ? THEN 'owned' ELSE 'accessible' END as access_type,
		       i.household_id = ? as can_edit,
		       pc.name as pantryCategory_name,
		       sc.name as supermarketCategory_name
		FROM ingredients i
		LEFT JOIN pantry_categories pc ON i.pantryCategory_id = pc.id
		LEFT JOIN supermarket_categories sc ON i.supermarketCategory_id = sc.id
		LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
		LEFT JOIN recipes r ON ri.recipe_id = r.id
		LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
		LEFT JOIN collections c ON cr.collection_id = c.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE (
		  i.household_id = ? OR  -- Household's own ingredients
		  c.id = 1 OR           -- Always include Spencer's essentials (collection_id=1)
		  cs.household_id IS NOT NULL  -- Ingredients from subscribed collections
		)
		AND NOT EXISTS (
		  SELECT 1 FROM ingredients i2 
		  WHERE i2.household_id = ? 
		  AND i2.parent_id = i.id
		  AND i.household_id != ?
		)
		AND (
		  LOWER(i.name) LIKE LOWER(?) OR
		  LOWER(pc.name) LIKE LOWER(?) OR
		  LOWER(sc.name) LIKE LOWER(?)
		)
		ORDER BY access_type ASC, i.name ASC
	`;

	const [rows] = await pool.execute(query, [
		household_id,
		household_id,
		household_id,
		household_id,
		household_id,
		household_id,
		searchPattern,
		searchPattern,
		searchPattern,
	]);
	return rows as IngredientSearchResult[];
}

/**
 * Client-side filtering helper for performance optimization
 * Use this when you have pre-loaded household data and want to filter locally
 * @param recipes - Pre-loaded recipes array
 * @param searchTerm - The search term to filter by
 * @returns Filtered recipes array
 */
export function filterRecipesClientSide(recipes: Recipe[], searchTerm: string): Recipe[] {
	const search = searchTerm.toLowerCase();
	return recipes.filter(
		recipe =>
			recipe.name.toLowerCase().includes(search) || recipe.description?.toLowerCase().includes(search) || recipe.seasonName?.toLowerCase().includes(search)
		// Note: client-side ingredient search would require pre-loading ingredients
	);
}

/**
 * Get search suggestions based on partial input
 * @param partialTerm - The partial search term (minimum 2 characters)
 * @param household_id - The household requesting suggestions
 * @param limit - Maximum number of suggestions to return
 * @returns Array of search suggestions grouped by type
 */
export async function getSearchSuggestions(
	partialTerm: string,
	household_id: number,
	limit: number = 10
): Promise<{
	recipes: Array<{ id: number; name: string; type: 'recipe' }>;
	collections: Array<{ id: number; title: string; type: 'collection' }>;
	ingredients: Array<{ id: number; name: string; type: 'ingredient' }>;
}> {
	if (partialTerm.length < 2) {
		return { recipes: [], collections: [], ingredients: [] };
	}

	const searchPattern = `%${partialTerm.toLowerCase()}%`;

	// Get recipe suggestions
	const recipeQuery = `
		SELECT DISTINCT r.id, r.name, 'recipe' as type
		FROM recipes r
		LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
		LEFT JOIN collections c ON cr.collection_id = c.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE (
		  r.household_id = ? OR
		  c.public = 1 OR
		  cs.household_id IS NOT NULL
		)
		AND NOT EXISTS (
		  SELECT 1 FROM recipes r2 
		  WHERE r2.household_id = ? AND r2.parent_id = r.id AND r.household_id != ?
		)
		AND LOWER(r.name) LIKE LOWER(?)
		ORDER BY r.name ASC
		LIMIT ?
	`;

	// Get collection suggestions
	const collectionQuery = `
		SELECT DISTINCT c.id, c.title, 'collection' as type
		FROM collections c
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE (
		  c.household_id = ? OR
		  cs.household_id IS NOT NULL OR
		  c.public = 1
		)
		AND LOWER(c.title) LIKE LOWER(?)
		ORDER BY c.title ASC
		LIMIT ?
	`;

	// Get ingredient suggestions
	const ingredientQuery = `
		SELECT DISTINCT i.id, i.name, 'ingredient' as type
		FROM ingredients i
		LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
		LEFT JOIN recipes r ON ri.recipe_id = r.id
		LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
		LEFT JOIN collections c ON cr.collection_id = c.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE (
		  i.household_id = ? OR
		  c.id = 1 OR
		  cs.household_id IS NOT NULL
		)
		AND NOT EXISTS (
		  SELECT 1 FROM ingredients i2 
		  WHERE i2.household_id = ? AND i2.parent_id = i.id AND i.household_id != ?
		)
		AND LOWER(i.name) LIKE LOWER(?)
		ORDER BY i.name ASC
		LIMIT ?
	`;

	const [recipeRows] = await pool.execute(recipeQuery, [household_id, household_id, household_id, household_id, searchPattern, limit]);

	const [collectionRows] = await pool.execute(collectionQuery, [household_id, household_id, searchPattern, limit]);

	const [ingredientRows] = await pool.execute(ingredientQuery, [household_id, household_id, household_id, household_id, searchPattern, limit]);

	return {
		recipes: recipeRows as Array<{ id: number; name: string; type: 'recipe' }>,
		collections: collectionRows as Array<{ id: number; title: string; type: 'collection' }>,
		ingredients: ingredientRows as Array<{ id: number; name: string; type: 'ingredient' }>,
	};
}
