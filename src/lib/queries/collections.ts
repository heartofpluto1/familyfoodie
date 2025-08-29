import pool from '@/lib/db.js';

export interface Collection {
	id: number;
	title: string;
	subtitle: string | null;
	filename: string | null;
	filename_dark: string | null;
	url_slug: string;
	created_at: Date;
	updated_at: Date;
	recipe_count?: number;
	// Extended fields for household context
	household_id?: number;
	household_name?: string;
	access_type?: 'owned' | 'subscribed' | 'public';
	can_edit?: boolean;
	can_subscribe?: boolean;
}

/**
 * Get all collections with recipe counts
 */
export async function getAllCollections(): Promise<Collection[]> {
	const query = `
		SELECT 
			c.id,
			c.title,
			c.subtitle,
			c.filename,
			c.filename_dark,
			c.url_slug,
			c.created_at,
			c.updated_at,
			COUNT(CASE WHEN r.archived = 0 THEN cr.recipe_id END) as recipe_count
		FROM collections c
		LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
		LEFT JOIN recipes r ON cr.recipe_id = r.id
		GROUP BY c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, c.created_at, c.updated_at
		ORDER BY c.id ASC
	`;

	const [rows] = await pool.execute(query);
	return rows as Collection[];
}

/**
 * Get a single collection by ID
 */
export async function getCollectionById(id: number): Promise<Collection | null> {
	const query = `
		SELECT 
			c.id,
			c.title,
			c.subtitle,
			c.filename,
			c.filename_dark,
			c.url_slug,
			c.created_at,
			c.updated_at,
			COUNT(CASE WHEN r.archived = 0 THEN cr.recipe_id END) as recipe_count
		FROM collections c
		LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
		LEFT JOIN recipes r ON cr.recipe_id = r.id
		WHERE c.id = ?
		GROUP BY c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, c.created_at, c.updated_at
	`;

	const [rows] = await pool.execute(query, [id]);
	const collections = rows as Collection[];
	return collections.length > 0 ? collections[0] : null;
}

/**
 * Get collections for display
 */
export async function getCollectionsForDisplay(): Promise<Collection[]> {
	return await getAllCollections();
}

/**
 * Get collections owned by or subscribed to by a household (Agent 2 implementation)
 * Returns collections the user can access for meal planning
 */
export async function getMyCollections(householdId: number): Promise<Collection[]> {
	const query = `
		SELECT c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, 
		       c.created_at, c.updated_at, h.name as household_name,
		       CASE WHEN c.household_id = ? THEN 'owned' ELSE 'subscribed' END as access_type,
		       COUNT(CASE WHEN r.archived = 0 THEN cr.recipe_id END) as recipe_count,
		       c.household_id = ? as can_edit,
		       false as can_subscribe,
		       c.household_id
		FROM collections c
		JOIN households h ON c.household_id = h.id
		LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
		LEFT JOIN recipes r ON cr.recipe_id = r.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE c.household_id = ? OR cs.household_id IS NOT NULL
		GROUP BY c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, c.created_at, c.updated_at, h.name, c.household_id
		ORDER BY access_type ASC, c.title ASC
	`;

	const [rows] = await pool.execute(query, [householdId, householdId, householdId, householdId]);
	return rows as Collection[];
}

/**
 * Get public collections available for browsing/discovery (Agent 2 implementation)
 * Returns collections the user can browse and potentially subscribe to
 */
export async function getPublicCollections(householdId: number): Promise<Collection[]> {
	const query = `
		SELECT c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, 
		       c.created_at, c.updated_at, h.name as household_name,
		       CASE 
		         WHEN c.household_id = ? THEN 'owned'
		         WHEN cs.household_id IS NOT NULL THEN 'subscribed' 
		         ELSE 'public' 
		       END as access_type,
		       COUNT(CASE WHEN r.archived = 0 THEN cr.recipe_id END) as recipe_count,
		       c.household_id = ? as can_edit,
		       cs.household_id IS NULL AND c.household_id != ? as can_subscribe,
		       c.household_id
		FROM collections c
		JOIN households h ON c.household_id = h.id
		LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
		LEFT JOIN recipes r ON cr.recipe_id = r.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE c.public = 1
		GROUP BY c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, c.created_at, c.updated_at, h.name, c.household_id, cs.household_id
		ORDER BY c.title ASC
	`;

	const [rows] = await pool.execute(query, [householdId, householdId, householdId, householdId]);
	return rows as Collection[];
}

/**
 * Get a single collection by ID with household context (Agent 2 implementation)
 * Updates the existing function signature to include household context
 */
export async function getCollectionByIdWithHousehold(id: number, householdId: number): Promise<Collection | null> {
	const query = `
		SELECT c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, 
		       c.created_at, c.updated_at, h.name as household_name,
		       CASE 
		         WHEN c.household_id = ? THEN 'owned'
		         WHEN cs.household_id IS NOT NULL THEN 'subscribed' 
		         WHEN c.public = 1 THEN 'public'
		         ELSE NULL 
		       END as access_type,
		       COUNT(CASE WHEN r.archived = 0 THEN cr.recipe_id END) as recipe_count,
		       c.household_id = ? as can_edit,
		       (c.public = 1 AND c.household_id != ? AND cs.household_id IS NULL) as can_subscribe,
		       c.household_id
		FROM collections c
		JOIN households h ON c.household_id = h.id
		LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
		LEFT JOIN recipes r ON cr.recipe_id = r.id
		LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
		WHERE c.id = ?
		AND (
		  c.household_id = ? OR           -- User owns collection
		  cs.household_id IS NOT NULL OR  -- User subscribed to collection
		  c.public = 1                    -- Public collection
		)
		GROUP BY c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, c.created_at, c.updated_at, h.name, c.household_id, cs.household_id
	`;

	const [rows] = await pool.execute(query, [householdId, householdId, householdId, householdId, id, householdId]);
	const collections = rows as Collection[];
	return collections.length > 0 ? collections[0] : null;
}
