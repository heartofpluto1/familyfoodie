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
	// Calculate dates in JavaScript instead of using MySQL functions
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentWeek = Math.ceil((now.getTime() - new Date(currentYear, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
	const fourWeeksAgo = currentWeek - 4;

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
			AND p.year >= ?
			AND (
				p.year > ? 
				OR (p.year = ? AND p.week >= ?)
			)
		GROUP BY r.id, r.name, r.url_slug, r.image_filename, r.cookTime, r.prepTime
		ORDER BY plan_count DESC, r.name ASC
		LIMIT ?
	`;

	const [rows] = await pool.execute<RowDataPacket[]>(query, [currentYear, currentYear, currentYear, fourWeeksAgo, limit]);

	return rows as PopularRecipe[];
}

export async function getRecentlyPlannedCount(): Promise<number> {
	// Calculate dates in JavaScript instead of using MySQL functions
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentWeek = Math.ceil((now.getTime() - new Date(currentYear, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
	const fourWeeksAgo = currentWeek - 4;

	const query = `
		SELECT COUNT(DISTINCT household_id) as active_households
		FROM plans
		WHERE year = ?
			AND week >= ?
	`;

	const [rows] = await pool.execute<RowDataPacket[]>(query, [currentYear, fourWeeksAgo]);
	return rows[0]?.active_households || 0;
}
