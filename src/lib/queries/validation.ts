import pool from '@/lib/db.js';

/**
 * Validation utilities for household-aware access control
 * Handles URL validation, access permissions, and SEO routing
 */

/**
 * Validate collection access level for a household
 * @param collectionId - The collection to validate access for
 * @param household_id - The household requesting access
 * @returns Access level or null if no access
 */
export async function validateCollectionAccess(collectionId: number, household_id: number): Promise<'owned' | 'subscribed' | 'public' | null> {
	const query = `
		SELECT c.household_id, c.public,
		       cs.household_id as is_subscribed
		FROM collections c
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE c.id = ?
	`;

	const [rows] = await pool.execute(query, [household_id, collectionId]);
	const collections = rows as Array<{
		household_id: number;
		public: number;
		is_subscribed: number | null;
	}>;

	if (collections.length === 0) {
		return null; // Collection not found
	}

	const collection = collections[0];

	if (collection.household_id === household_id) {
		return 'owned';
	} else if (collection.is_subscribed) {
		return 'subscribed';
	} else if (collection.public) {
		return 'public';
	} else {
		return null; // No access to private collection
	}
}

/**
 * Validate recipe access within a specific collection context
 * @param recipeId - The recipe to validate access for
 * @param collectionId - The collection context for the recipe
 * @param household_id - The household requesting access
 * @returns true if access is allowed, false otherwise
 */
export async function validateRecipeAccess(recipeId: number, collectionId: number, household_id: number): Promise<boolean> {
	const query = `
		SELECT r.household_id as recipe_household_id,
		       c.household_id as collection_household_id,
		       c.public as collection_public,
		       cs.household_id as is_subscribed_to_collection
		FROM recipes r
		JOIN collection_recipes cr ON r.id = cr.recipe_id
		JOIN collections c ON cr.collection_id = c.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE r.id = ? AND c.id = ?
	`;

	const [rows] = await pool.execute(query, [household_id, recipeId, collectionId]);
	const results = rows as Array<{
		recipe_household_id: number;
		collection_household_id: number;
		collection_public: number;
		is_subscribed_to_collection: number | null;
	}>;

	if (results.length === 0) {
		return false; // Recipe not found in collection
	}

	const access = results[0];

	// User can access recipe if:
	// 1. They own the recipe
	// 2. They own the collection containing the recipe
	// 3. They're subscribed to the collection containing the recipe
	// 4. The collection containing the recipe is public
	return (
		access.recipe_household_id === household_id ||
		access.collection_household_id === household_id ||
		!!access.is_subscribed_to_collection ||
		!!access.collection_public
	);
}

/**
 * Validate ingredient access through recipe and collection context
 * @param ingredientId - The ingredient to validate access for
 * @param household_id - The household requesting access
 * @returns true if access is allowed, false otherwise
 */
export async function validateIngredientAccess(ingredientId: number, household_id: number): Promise<boolean> {
	const query = `
		SELECT DISTINCT i.household_id as ingredient_household_id,
		       r.household_id as recipe_household_id,
		       c.household_id as collection_household_id,
		       c.public as collection_public,
		       cs.household_id as is_subscribed_to_collection
		FROM ingredients i
		LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
		LEFT JOIN recipes r ON ri.recipe_id = r.id
		LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
		LEFT JOIN collections c ON cr.collection_id = c.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE i.id = ?
	`;

	const [rows] = await pool.execute(query, [household_id, ingredientId]);
	const results = rows as Array<{
		ingredient_household_id: number;
		recipe_household_id: number | null;
		collection_household_id: number | null;
		collection_public: number | null;
		is_subscribed_to_collection: number | null;
	}>;

	if (results.length === 0) {
		return false; // Ingredient not found
	}

	// Check if user has access through ingredient ownership or through recipes/collections
	return results.some(result => {
		return (
			result.ingredient_household_id === household_id || // User owns the ingredient
			result.recipe_household_id === household_id || // User owns a recipe that uses it
			result.collection_household_id === household_id || // User owns a collection with recipes that use it
			!!result.is_subscribed_to_collection || // User is subscribed to a collection with recipes that use it
			!!result.collection_public || // Ingredient is in public collections
			result.collection_household_id === 1 // Always allow Spencer's essentials (collection_id=1)
		);
	});
}

/**
 * Helper function for URL slug validation with household context
 * @param collectionSlug - The collection URL slug
 * @param recipeSlug - The recipe URL slug (optional)
 * @param household_id - The household requesting access
 * @returns Object with collection_id and recipe_id if access allowed, null otherwise
 */
export async function validateSlugAccess(
	collectionSlug: string,
	recipeSlug: string | null,
	household_id: number
): Promise<{ collection_id: number; recipe_id?: number } | null> {
	if (recipeSlug) {
		// Validate both collection and recipe slugs
		const query = `
			SELECT c.id as collection_id, r.id as recipe_id
			FROM collections c
			JOIN collection_recipes cr ON c.id = cr.collection_id
			JOIN recipes r ON cr.recipe_id = r.id
			LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
			WHERE c.url_slug = ? AND r.url_slug = ?
			AND (
			  c.household_id = ? OR          -- User owns collection
			  r.household_id = ? OR          -- User owns recipe
			  cs.household_id IS NOT NULL OR -- User subscribed to collection
			  c.public = 1                   -- Collection is public
			)
		`;

		const [rows] = await pool.execute(query, [household_id, collectionSlug, recipeSlug, household_id, household_id]);
		const results = rows as Array<{ collection_id: number; recipe_id: number }>;

		return results.length > 0 ? results[0] : null;
	} else {
		// Validate collection slug only
		const query = `
			SELECT c.id as collection_id
			FROM collections c
			LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
			WHERE c.url_slug = ?
			AND (
			  c.household_id = ? OR          -- User owns collection
			  cs.household_id IS NOT NULL OR -- User subscribed to collection
			  c.public = 1                   -- Collection is public
			)
		`;

		const [rows] = await pool.execute(query, [household_id, collectionSlug, household_id]);
		const results = rows as Array<{ collection_id: number }>;

		return results.length > 0 ? { collection_id: results[0].collection_id } : null;
	}
}

/**
 * Check if a household can perform a specific action on a resource
 * @param household_id - The household requesting the action
 * @param resource_type - The type of resource
 * @param resource_id - The resource ID
 * @param action - The action to validate
 * @returns true if action is allowed, false otherwise
 */
export async function validateAction(
	household_id: number,
	resource_type: 'collection' | 'recipe' | 'ingredient',
	resource_id: number,
	action: 'view' | 'edit' | 'subscribe' | 'unsubscribe' | 'copy'
): Promise<boolean> {
	switch (resource_type) {
		case 'collection': {
			const access = await validateCollectionAccess(resource_id, household_id);
			switch (action) {
				case 'view':
					return access !== null;
				case 'edit':
					return access === 'owned';
				case 'subscribe':
					return access === 'public';
				case 'unsubscribe':
					return access === 'subscribed';
				case 'copy':
					return access === 'public' || access === 'subscribed';
				default:
					return false;
			}
		}

		case 'recipe': {
			// For recipes, we need to check through any collection context
			const query = `
				SELECT DISTINCT r.household_id as recipe_household_id,
				       c.household_id as collection_household_id,
				       c.public as collection_public,
				       cs.household_id as is_subscribed_to_collection
				FROM recipes r
				LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
				LEFT JOIN collections c ON cr.collection_id = c.id
				LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
				WHERE r.id = ?
			`;

			const [rows] = await pool.execute(query, [household_id, resource_id]);
			const results = rows as Array<{
				recipe_household_id: number;
				collection_household_id: number | null;
				collection_public: number | null;
				is_subscribed_to_collection: number | null;
			}>;

			if (results.length === 0) return false;

			const hasAccess = results.some(result => {
				return (
					result.recipe_household_id === household_id ||
					result.collection_household_id === household_id ||
					!!result.is_subscribed_to_collection ||
					!!result.collection_public
				);
			});

			const isOwned = results.some(result => result.recipe_household_id === household_id);

			switch (action) {
				case 'view':
					return hasAccess;
				case 'edit':
					return isOwned;
				case 'copy':
					return hasAccess && !isOwned;
				default:
					return false;
			}
		}

		case 'ingredient': {
			const hasAccess = await validateIngredientAccess(resource_id, household_id);
			if (!hasAccess) return false;

			// Check if owned
			const query = `SELECT household_id FROM ingredients WHERE id = ?`;
			const [rows] = await pool.execute(query, [resource_id]);
			const ingredients = rows as Array<{ household_id: number }>;
			const isOwned = ingredients.length > 0 && ingredients[0].household_id === household_id;

			switch (action) {
				case 'view':
					return hasAccess;
				case 'edit':
					return isOwned;
				case 'copy':
					return hasAccess && !isOwned;
				default:
					return false;
			}
		}

		default:
			return false;
	}
}

/**
 * Get comprehensive access information for a resource
 * @param household_id - The household requesting information
 * @param resource_type - The type of resource
 * @param resource_id - The resource ID
 * @returns Detailed access information object
 */
export async function getAccessInfo(
	household_id: number,
	resource_type: 'collection' | 'recipe' | 'ingredient',
	resource_id: number
): Promise<{
	has_access: boolean;
	access_type: 'owned' | 'subscribed' | 'public' | null;
	can_view: boolean;
	can_edit: boolean;
	can_copy: boolean;
	can_subscribe?: boolean;
	can_unsubscribe?: boolean;
} | null> {
	switch (resource_type) {
		case 'collection': {
			const access = await validateCollectionAccess(resource_id, household_id);
			if (!access) return null;

			return {
				has_access: true,
				access_type: access,
				can_view: true,
				can_edit: access === 'owned',
				can_copy: access === 'public' || access === 'subscribed',
				can_subscribe: access === 'public',
				can_unsubscribe: access === 'subscribed',
			};
		}

		case 'recipe': {
			const canView = await validateAction(household_id, 'recipe', resource_id, 'view');
			if (!canView) return null;

			const canEdit = await validateAction(household_id, 'recipe', resource_id, 'edit');
			const canCopy = await validateAction(household_id, 'recipe', resource_id, 'copy');

			return {
				has_access: true,
				access_type: canEdit ? 'owned' : 'public',
				can_view: true,
				can_edit: canEdit,
				can_copy: canCopy,
			};
		}

		case 'ingredient': {
			const canView = await validateIngredientAccess(resource_id, household_id);
			if (!canView) return null;

			const canEdit = await validateAction(household_id, 'ingredient', resource_id, 'edit');
			const canCopy = await validateAction(household_id, 'ingredient', resource_id, 'copy');

			return {
				has_access: true,
				access_type: canEdit ? 'owned' : 'public',
				can_view: true,
				can_edit: canEdit,
				can_copy: canCopy,
			};
		}

		default:
			return null;
	}
}
