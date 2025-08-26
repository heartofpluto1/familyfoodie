import pool from '@/lib/db.js';
import { Collection } from '@/lib/queries/collections.js';

/**
 * Collection subscription management system
 * Handles subscription to public collections for household access
 */

/**
 * Subscribe a household to a public collection
 * @param household_id - The household wanting to subscribe
 * @param collection_id - The collection to subscribe to
 * @returns true if subscription successful, false if already subscribed
 * @throws Error if collection not found, not public, or owned by same household
 */
export async function subscribeToCollection(household_id: number, collection_id: number): Promise<boolean> {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();

		// Check if collection exists and is public
		const checkQuery = `
			SELECT c.id, c.public, c.household_id
			FROM collections c 
			WHERE c.id = ?
		`;
		const [checkRows] = await connection.execute(checkQuery, [collection_id]);
		const collections = checkRows as Array<{ id: number; public: number; household_id: number }>;

		if (collections.length === 0) {
			throw new Error('Collection not found');
		}

		const collection = collections[0];

		// Cannot subscribe to own collections
		if (collection.household_id === household_id) {
			throw new Error('Cannot subscribe to your own collection');
		}

		// Can only subscribe to public collections
		if (!collection.public) {
			throw new Error('Cannot subscribe to private collection');
		}

		// Check if already subscribed
		const existsQuery = `
			SELECT 1 FROM collection_subscriptions 
			WHERE household_id = ? AND collection_id = ?
		`;
		const [existsRows] = await connection.execute(existsQuery, [household_id, collection_id]);

		if ((existsRows as unknown[]).length > 0) {
			await connection.rollback();
			return false; // Already subscribed
		}

		// Insert subscription
		const insertQuery = `
			INSERT INTO collection_subscriptions (household_id, collection_id, subscribed_at)
			VALUES (?, ?, NOW())
		`;
		await connection.execute(insertQuery, [household_id, collection_id]);

		await connection.commit();
		return true;
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Unsubscribe a household from a collection
 * @param household_id - The household wanting to unsubscribe
 * @param collection_id - The collection to unsubscribe from
 * @returns true if unsubscription successful, false if wasn't subscribed
 */
export async function unsubscribeFromCollection(household_id: number, collection_id: number): Promise<boolean> {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();

		// Delete subscription
		const deleteQuery = `
			DELETE FROM collection_subscriptions 
			WHERE household_id = ? AND collection_id = ?
		`;
		const [result] = await connection.execute(deleteQuery, [household_id, collection_id]);

		await connection.commit();
		return (result as { affectedRows: number }).affectedRows > 0;
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Get all collections a household is subscribed to
 * @param household_id - The household to get subscriptions for
 * @returns Array of subscribed collections with metadata
 */
export async function getSubscribedCollections(household_id: number): Promise<Collection[]> {
	const query = `
		SELECT c.*, h.name as owner_name,
		       'subscribed' as access_type,
		       COUNT(cr.recipe_id) as recipe_count,
		       false as can_edit,
		       true as can_subscribe,
		       cs.subscribed_at
		FROM collections c
		JOIN households h ON c.household_id = h.id
		JOIN collection_subscriptions cs ON c.id = cs.collection_id
		LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
		WHERE cs.household_id = ?
		GROUP BY c.id
		ORDER BY cs.subscribed_at DESC, c.title ASC
	`;

	const [rows] = await pool.execute(query, [household_id]);
	return rows as Collection[];
}

/**
 * Check if a household is subscribed to a specific collection
 * @param household_id - The household to check
 * @param collection_id - The collection to check subscription for
 * @returns true if subscribed, false otherwise
 */
export async function isSubscribed(household_id: number, collection_id: number): Promise<boolean> {
	const query = `
		SELECT 1 FROM collection_subscriptions 
		WHERE household_id = ? AND collection_id = ?
	`;

	const [rows] = await pool.execute(query, [household_id, collection_id]);
	return (rows as unknown[]).length > 0;
}

/**
 * Get subscription statistics for a household
 * @param household_id - The household to get statistics for
 * @returns Object with subscription counts and data
 */
export async function getSubscriptionStats(household_id: number): Promise<{
	total_subscriptions: number;
	total_subscribed_recipes: number;
	recent_subscriptions: Collection[];
}> {
	// Get total subscriptions count
	const countQuery = `
		SELECT COUNT(*) as total_subscriptions,
		       COALESCE(SUM(
		         (SELECT COUNT(*) FROM collection_recipes cr2 WHERE cr2.collection_id = c.id)
		       ), 0) as total_subscribed_recipes
		FROM collections c
		JOIN collection_subscriptions cs ON c.id = cs.collection_id
		WHERE cs.household_id = ?
	`;

	const [countRows] = await pool.execute(countQuery, [household_id]);
	const stats = (countRows as Array<{ total_subscriptions: number; total_subscribed_recipes: number }>)[0];

	// Get recent subscriptions (last 5)
	const recentQuery = `
		SELECT c.*, h.name as owner_name,
		       'subscribed' as access_type,
		       COUNT(cr.recipe_id) as recipe_count,
		       false as can_edit,
		       true as can_subscribe,
		       cs.subscribed_at
		FROM collections c
		JOIN households h ON c.household_id = h.id
		JOIN collection_subscriptions cs ON c.id = cs.collection_id
		LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
		WHERE cs.household_id = ?
		GROUP BY c.id
		ORDER BY cs.subscribed_at DESC
		LIMIT 5
	`;

	const [recentRows] = await pool.execute(recentQuery, [household_id]);

	return {
		total_subscriptions: stats.total_subscriptions,
		total_subscribed_recipes: stats.total_subscribed_recipes,
		recent_subscriptions: recentRows as Collection[],
	};
}
