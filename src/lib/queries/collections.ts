import pool from '@/lib/db.js';

export interface Collection {
	id: number;
	title: string;
	subtitle: string | null;
	filename: string | null;
	filename_dark: string | null;
	url_slug: string | null;
	created_at: Date;
	updated_at: Date;
	recipe_count?: number;
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
			COUNT(r.id) as recipe_count
		FROM collections c
		LEFT JOIN recipes r ON c.id = r.collection_id
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
			COUNT(r.id) as recipe_count
		FROM collections c
		LEFT JOIN recipes r ON c.id = r.collection_id
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
