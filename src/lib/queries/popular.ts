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

	// Handle year boundary - if we're in the first 4 weeks, look at the previous year
	let startYear = currentYear;
	let startWeek = currentWeek - 4;

	if (startWeek < 1) {
		startYear = currentYear - 1;
		startWeek = 52 + startWeek; // Wrap around to previous year
	}

	// Simplified query that matches the pattern used in menus.ts
	// Note: LIMIT must be hardcoded as MySQL doesn't support parameterized LIMIT in prepared statements
	const query = `
		SELECT 
			r.id,
			r.name,
			r.url_slug,
			r.image_filename,
			r.cookTime,
			r.prepTime,
			COUNT(*) as plan_count
		FROM recipes r
		INNER JOIN plans p ON r.id = p.recipe_id
		WHERE r.public = 1
			AND ((p.year = ? AND p.week >= ?) OR p.year > ?)
		GROUP BY r.id
		ORDER BY plan_count DESC, r.name ASC
		LIMIT ${Math.min(limit, 10)}
	`;

	const [rows] = await pool.execute<RowDataPacket[]>(query, [startYear, startWeek, startYear]);

	return rows as PopularRecipe[];
}

export async function getRecentlyPlannedCount(): Promise<number> {
	// Calculate dates in JavaScript instead of using MySQL functions
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentWeek = Math.ceil((now.getTime() - new Date(currentYear, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

	// Handle year boundary - if we're in the first 4 weeks, look at the previous year
	let startYear = currentYear;
	let startWeek = currentWeek - 4;

	if (startWeek < 1) {
		startYear = currentYear - 1;
		startWeek = 52 + startWeek; // Wrap around to previous year
	}

	const query = `
		SELECT COUNT(DISTINCT household_id) as active_households
		FROM plans
		WHERE (year = ? AND week >= ?) OR year > ?
	`;

	const [rows] = await pool.execute<RowDataPacket[]>(query, [startYear, startWeek, startYear]);
	return rows[0]?.active_households || 0;
}
