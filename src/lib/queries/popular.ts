import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';

export interface PopularRecipe {
	id: number;
	name: string;
	url_slug: string;
	image_filename: string | null;
	cookTime: number;
	prepTime: number | null;
	plan_count: number;
}

export async function getPopularRecipes(limit: number = 3): Promise<PopularRecipe[]> {
	const query = `
		SELECT 
			r.id,
			r.name,
			r.url_slug,
			r.image_filename,
			r.cookTime,
			r.prepTime,
			COUNT(p.id) as plan_count
		FROM recipes r
		INNER JOIN plans p ON r.id = p.recipe_id
		WHERE r.public = 1
			AND r.archived = 0
			AND p.year >= YEAR(CURDATE())
			AND (
				p.year > YEAR(CURDATE()) 
				OR (p.year = YEAR(CURDATE()) AND p.week >= WEEK(CURDATE()) - 4)
			)
		GROUP BY r.id, r.name, r.url_slug, r.image_filename, r.cookTime, r.prepTime
		ORDER BY plan_count DESC, r.name ASC
		LIMIT ?
	`;

	const [rows] = await pool.execute<RowDataPacket[]>(query, [limit]);

	return rows as PopularRecipe[];
}

export async function getRecentlyPlannedCount(): Promise<number> {
	const query = `
		SELECT COUNT(DISTINCT household_id) as active_households
		FROM plans
		WHERE year = YEAR(CURDATE())
			AND week >= WEEK(CURDATE()) - 4
	`;

	const [rows] = await pool.execute<RowDataPacket[]>(query);
	return rows[0]?.active_households || 0;
}
