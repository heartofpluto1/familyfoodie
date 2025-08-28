// lib/permissions.ts - Permission system for household resource access
import pool from './db.js';
import { addToast } from '@/lib/toast';

/**
 * Resource types that can be owned by households
 */
export type ResourceType = 'collections' | 'recipes' | 'ingredients' | 'plans' | 'shopping_lists';

/**
 * Collection access levels for subscription system
 */
export type CollectionAccessLevel = 'owned' | 'subscribed' | 'public' | null;

/**
 * Check if a user can edit a specific resource
 * Resources are editable only if they are owned by the user's household
 */
export async function canEditResource(userHouseholdId: number, resourceType: ResourceType, resourceId: number): Promise<boolean> {
	try {
		const query = `SELECT household_id FROM ${resourceType} WHERE id = ?`;
		const [rows] = await pool.execute(query, [resourceId]);

		const resources = rows as Array<{ household_id: number }>;
		if (resources.length === 0) {
			return false; // Resource not found
		}

		return resources[0].household_id === userHouseholdId;
	} catch (error) {
		addToast('error', 'Permission Check Error', `Failed to check edit permissions: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

/**
 * Validate household access to a collection
 * Returns the access level (owned/subscribed/public) or null if no access
 */
export async function validateHouseholdAccess(userHouseholdId: number, collectionId: number): Promise<CollectionAccessLevel> {
	try {
		const query = `
			SELECT c.household_id, c.public,
			       cs.household_id as is_subscribed
			FROM collections c
			LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
			WHERE c.id = ?
		`;

		const [rows] = await pool.execute(query, [userHouseholdId, collectionId]);
		const collections = rows as Array<{
			household_id: number;
			public: number;
			is_subscribed: number | null;
		}>;

		if (collections.length === 0) {
			return null; // Collection not found
		}

		const collection = collections[0];

		if (collection.household_id === userHouseholdId) {
			return 'owned';
		} else if (collection.is_subscribed) {
			return 'subscribed';
		} else if (collection.public) {
			return 'public';
		} else {
			return null; // No access to private collection
		}
	} catch (error) {
		addToast('error', 'Access Validation Error', `Failed to validate collection access: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}

/**
 * Validate that a household has access to a specific collection
 * This prevents enumeration attacks by only returning access for owned/subscribed/public collections
 * @param collectionId The collection ID to validate access to
 * @param userHouseholdId The requesting user's household ID
 * @returns true if household has access (owned, subscribed, or public), false otherwise
 */
export async function validateHouseholdCollectionAccess(collectionId: number, userHouseholdId: number): Promise<boolean> {
	try {
		const query = `
			SELECT 1 
			FROM collections c
			LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
			WHERE c.id = ?
			AND (
				c.household_id = ? OR          -- User owns collection
				cs.household_id IS NOT NULL OR -- User is subscribed
				c.public = 1                   -- Collection is public
			)
		`;

		const [rows] = await pool.execute(query, [userHouseholdId, collectionId, userHouseholdId]);

		const results = rows as Array<unknown>;
		return results.length > 0;
	} catch (error) {
		addToast('error', 'Validation Error', `Failed to validate household collection access: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

/**
 * Validate that a recipe belongs to a specific collection AND that the household has access
 * This prevents enumeration attacks and ensures proper authorization
 * @param recipeId The recipe ID to validate
 * @param collectionId The collection ID to validate
 * @param userHouseholdId The requesting user's household ID
 * @returns true if recipe is in collection and household has access, false otherwise
 */
export async function validateRecipeInCollection(recipeId: number, collectionId: number, userHouseholdId: number): Promise<boolean> {
	try {
		// First check if household has access to the collection
		const hasCollectionAccess = await validateHouseholdCollectionAccess(collectionId, userHouseholdId);
		if (!hasCollectionAccess) {
			return false; // Don't reveal whether recipe exists in collection
		}

		// Only if household has collection access, check if recipe is in collection
		const query = 'SELECT 1 FROM collection_recipes WHERE recipe_id = ? AND collection_id = ?';
		const [rows] = await pool.execute(query, [recipeId, collectionId]);

		const results = rows as Array<unknown>;
		return results.length > 0;
	} catch (error) {
		addToast('error', 'Validation Error', `Failed to validate recipe-collection relationship: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

/**
 * Check if a user can access a specific recipe within a collection context
 * Considers recipe ownership, collection ownership, and subscription status
 */
export async function canAccessRecipe(userHouseholdId: number, recipeId: number, collectionId?: number): Promise<boolean> {
	try {
		let query: string;
		let params: unknown[];

		if (collectionId) {
			// Check access within collection context
			query = `
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
			params = [userHouseholdId, recipeId, collectionId];
		} else {
			// Check general recipe access
			query = `
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
			params = [userHouseholdId, recipeId];
		}

		const [rows] = await pool.execute(query, params);
		const results = rows as Array<{
			recipe_household_id: number;
			collection_household_id: number | null;
			collection_public: number | null;
			is_subscribed_to_collection: number | null;
		}>;

		if (results.length === 0) {
			return false; // Recipe not found or not in any accessible collection
		}

		// Check if user has access through any of the collections containing this recipe
		return results.some(result => {
			return (
				result.recipe_household_id === userHouseholdId || // User owns the recipe
				result.collection_household_id === userHouseholdId || // User owns the collection
				result.is_subscribed_to_collection || // User is subscribed to the collection
				result.collection_public // Collection is public
			);
		});
	} catch (error) {
		addToast('error', 'Recipe Access Error', `Failed to check recipe access: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

/**
 * Check if a user can access a specific ingredient
 * Considers ingredient ownership and recipes that use the ingredient
 */
export async function canAccessIngredient(userHouseholdId: number, ingredientId: number): Promise<boolean> {
	try {
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

		const [rows] = await pool.execute(query, [userHouseholdId, ingredientId]);
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
				result.ingredient_household_id === userHouseholdId || // User owns the ingredient
				result.recipe_household_id === userHouseholdId || // User owns a recipe that uses it
				result.collection_household_id === userHouseholdId || // User owns a collection with recipes that use it
				result.is_subscribed_to_collection || // User is subscribed to a collection with recipes that use it
				result.collection_public || // Ingredient is in public collections
				result.collection_household_id === 1 // Always allow Spencer's essentials (collection_id=1)
			);
		});
	} catch (error) {
		addToast('error', 'Ingredient Access Error', `Failed to check ingredient access: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

/**
 * Bulk permission check for multiple resources of the same type
 * More efficient than checking permissions one by one
 */
export async function canEditMultipleResources(userHouseholdId: number, resourceType: ResourceType, resourceIds: number[]): Promise<Record<number, boolean>> {
	if (resourceIds.length === 0) {
		return {};
	}

	try {
		const placeholders = resourceIds.map(() => '?').join(',');
		const query = `SELECT id, household_id FROM ${resourceType} WHERE id IN (${placeholders})`;
		const [rows] = await pool.execute(query, resourceIds);

		const resources = rows as Array<{ id: number; household_id: number }>;
		const permissions: Record<number, boolean> = {};

		// Initialize all permissions to false
		resourceIds.forEach(id => {
			permissions[id] = false;
		});

		// Set permissions based on household ownership
		resources.forEach(resource => {
			permissions[resource.id] = resource.household_id === userHouseholdId;
		});

		return permissions;
	} catch (error) {
		addToast('error', 'Bulk Permission Error', `Failed to check bulk permissions: ${error instanceof Error ? error.message : String(error)}`);
		// Return all false permissions on error
		const permissions: Record<number, boolean> = {};
		resourceIds.forEach(id => {
			permissions[id] = false;
		});
		return permissions;
	}
}

/**
 * Check if user has admin privileges
 * Admins can perform additional operations like viewing all households' data
 */
export async function isAdmin(userId: number): Promise<boolean> {
	try {
		const query = 'SELECT is_admin FROM users WHERE id = ?';
		const [rows] = await pool.execute(query, [userId]);

		const users = rows as Array<{ is_admin: number }>;
		return users.length > 0 && users[0].is_admin === 1;
	} catch (error) {
		addToast('error', 'Admin Check Error', `Failed to check admin status: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}
