import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';

interface WeeklySpending extends RowDataPacket {
	week: number;
	year: number;
	total_cost: number;
}

interface TopIngredient extends RowDataPacket {
	name: string;
	frequency: number;
}

interface TopRecipe extends RowDataPacket {
	id: number;
	name: string;
	filename: string;
	collection_id: number;
	collection_title: string;
	times_planned: number;
}

// Get average weekly spending over the last year
export async function getAverageWeeklySpending() {
	const oneYearAgo = new Date();
	oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
	const yearAgo = oneYearAgo.getFullYear();
	const weekAgo = Math.ceil((oneYearAgo.getTime() - new Date(oneYearAgo.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

	const [rows] = await pool.execute<WeeklySpending[]>(
		`SELECT 
			week, 
			year, 
			SUM(cost) as total_cost
		FROM shopping_lists
		WHERE 1=1
			AND ((year > ?) OR (year = ? AND week >= ?))
			AND cost IS NOT NULL
		GROUP BY year, week
		ORDER BY year DESC, week DESC`,
		[yearAgo, yearAgo, weekAgo]
	);

	if (rows.length === 0) return { average: 0, weeks: 0 };

	const totalSpent = rows.reduce((sum, row) => sum + (row.total_cost || 0), 0);
	const averageWeekly = totalSpent / rows.length;

	return {
		average: averageWeekly,
		weeks: rows.length,
		total: totalSpent,
	};
}

// Get top 10 fruits and vegetables from last 12 months (rolling)
export async function getTopFruitsAndVegetables() {
	const twelveMonthsAgo = new Date();
	twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

	// Convert to year/week format for comparison
	const cutoffYear = twelveMonthsAgo.getFullYear();
	const cutoffWeek = Math.ceil((twelveMonthsAgo.getTime() - new Date(twelveMonthsAgo.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

	const [rows] = await pool.execute<TopIngredient[]>(
		`SELECT 
			COALESCE(i.name, sl.name) as name,
			COUNT(DISTINCT CONCAT(sl.year, '-', sl.week)) as frequency
		FROM shopping_lists sl
		LEFT JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
		LEFT JOIN ingredients i ON ri.ingredient_id = i.id
		LEFT JOIN category_supermarket sc ON sl.supermarketCategory_id = sc.id
		WHERE 1=1
			AND ((sl.year > ?) OR (sl.year = ? AND sl.week >= ?))
			AND sl.fresh = 1
			AND (sc.name IN ('fresh-fruitvege') 
				OR sc.name LIKE '%fruit%' 
				OR sc.name LIKE '%vege%')
		GROUP BY COALESCE(i.name, sl.name)
		ORDER BY frequency DESC
		LIMIT 10`,
		[cutoffYear, cutoffYear, cutoffWeek]
	);

	return rows;
}

// Get top 10 herbs from last 12 months (rolling)
export async function getTopHerbs() {
	const twelveMonthsAgo = new Date();
	twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

	// Convert to year/week format for comparison
	const cutoffYear = twelveMonthsAgo.getFullYear();
	const cutoffWeek = Math.ceil((twelveMonthsAgo.getTime() - new Date(twelveMonthsAgo.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

	const [rows] = await pool.execute<TopIngredient[]>(
		`SELECT 
			COALESCE(i.name, sl.name) as name,
			COUNT(DISTINCT CONCAT(sl.year, '-', sl.week)) as frequency
		FROM shopping_lists sl
		LEFT JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
		LEFT JOIN ingredients i ON ri.ingredient_id = i.id
		LEFT JOIN category_supermarket sc ON sl.supermarketCategory_id = sc.id
		WHERE 1=1
			AND ((sl.year > ?) OR (sl.year = ? AND sl.week >= ?))
			AND sl.fresh = 1
			AND (sc.name IN ('fresh-herbs') 
				OR sc.name LIKE '%herb%')
		GROUP BY COALESCE(i.name, sl.name)
		ORDER BY frequency DESC
		LIMIT 10`,
		[cutoffYear, cutoffYear, cutoffWeek]
	);

	return rows;
}

// Get top 10 recipes by frequency in recipe weeks (last 12 months rolling)
export async function getTopRecipes() {
	const twelveMonthsAgo = new Date();
	twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

	// Convert to year/week format for comparison
	const cutoffYear = twelveMonthsAgo.getFullYear();
	const cutoffWeek = Math.ceil((twelveMonthsAgo.getTime() - new Date(twelveMonthsAgo.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

	const [rows] = await pool.execute<TopRecipe[]>(
		`SELECT 
			r.id,
			r.name,
			r.filename,
			r.collection_id,
			c.title as collection_title,
			COUNT(DISTINCT CONCAT(rw.year, '-', rw.week)) as times_planned
		FROM plans rw
		INNER JOIN recipes r ON rw.recipe_id = r.id
		INNER JOIN collections c ON r.collection_id = c.id
		WHERE 1=1
			AND ((rw.year > ?) OR (rw.year = ? AND rw.week >= ?))
		GROUP BY r.id, r.name, r.filename, r.collection_id, c.title
		ORDER BY times_planned DESC
		LIMIT 10`,
		[cutoffYear, cutoffYear, cutoffWeek]
	);

	return rows;
}

// Get spending trend over last 12 weeks
export async function getSpendingTrend() {
	const [rows] = await pool.execute<WeeklySpending[]>(
		`SELECT 
			week, 
			year, 
			SUM(cost) as total_cost
		FROM shopping_lists
		WHERE 1=1
			AND cost IS NOT NULL
		GROUP BY year, week
		ORDER BY year DESC, week DESC
		LIMIT 12`
	);

	// Reverse to show oldest to newest
	return rows.reverse();
}

// Get potential garden savings for top items during Spring (Sept, Oct, Nov)
export async function getGardenSavings(topItems: TopIngredient[]) {
	if (topItems.length === 0) return [];

	// Take top 5 items
	const top5Items = topItems.slice(0, 5);
	const itemNames = top5Items.map(item => item.name);

	interface GardenSavings extends RowDataPacket {
		name: string;
		total_cost: number;
		frequency: number;
	}

	const [rows] = await pool.execute<GardenSavings[]>(
		`SELECT 
			COALESCE(i.name, sl.name) as name,
			SUM(sl.cost) as total_cost,
			COUNT(DISTINCT CONCAT(sl.year, '-', sl.week)) as frequency
		FROM shopping_lists sl
		LEFT JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
		LEFT JOIN ingredients i ON ri.ingredient_id = i.id
		WHERE 1=1
			AND sl.cost IS NOT NULL
			AND sl.cost > 0
			AND COALESCE(i.name, sl.name) IN (${itemNames.map(() => '?').join(', ')})
			AND (
				(sl.year = YEAR(CURDATE()) AND MONTH(STR_TO_DATE(CONCAT(sl.year, '-W', LPAD(sl.week, 2, '0'), '-1'), '%Y-W%u-%w')) IN (9, 10, 11))
				OR (sl.year = YEAR(CURDATE()) - 1 AND MONTH(STR_TO_DATE(CONCAT(sl.year, '-W', LPAD(sl.week, 2, '0'), '-1'), '%Y-W%u-%w')) IN (9, 10, 11))
				OR (sl.year = YEAR(CURDATE()) - 2 AND MONTH(STR_TO_DATE(CONCAT(sl.year, '-W', LPAD(sl.week, 2, '0'), '-1'), '%Y-W%u-%w')) IN (9, 10, 11))
			)
		GROUP BY COALESCE(i.name, sl.name)
		ORDER BY total_cost DESC`,
		itemNames
	);

	return rows;
}

// Interface for recipe pairing suggestions
interface RecipePairing extends RowDataPacket {
	recipe1_id: number;
	recipe1_name: string;
	recipe1_filename: string;
	recipe1_collection_id: number;
	recipe1_collection_title: string;
	recipe2_id: number;
	recipe2_name: string;
	recipe2_filename: string;
	recipe2_collection_id: number;
	recipe2_collection_title: string;
	shared_ingredient: string;
	recipe1_quantity: string;
	recipe2_quantity: string;
	ingredient_fresh: number;
	category_name: string;
	explanation: string;
}

// Get recipe pairing suggestions based on shared fractional fresh ingredients
export async function getRecipePairingSuggestions() {
	const [rows] = await pool.execute<RecipePairing[]>(
		`SELECT 
			recipe1_id,
			recipe1_name,
			recipe1_filename,
			recipe1_collection_id,
			recipe1_collection_title,
			recipe2_id,
			recipe2_name,
			recipe2_filename,
			recipe2_collection_id,
			recipe2_collection_title,
			shared_ingredient,
			recipe1_quantity,
			recipe2_quantity,
			ingredient_fresh,
			category_name,
			explanation
		FROM (
			SELECT DISTINCT
				r1.id as recipe1_id,
				r1.name as recipe1_name,
				r1.filename as recipe1_filename,
				r1.collection_id as recipe1_collection_id,
				c1.title as recipe1_collection_title,
				r2.id as recipe2_id,
				r2.name as recipe2_name,
				r2.filename as recipe2_filename,
				r2.collection_id as recipe2_collection_id,
				c2.title as recipe2_collection_title,
				i.name as shared_ingredient,
				ri1.quantity as recipe1_quantity,
				ri2.quantity as recipe2_quantity,
				i.fresh as ingredient_fresh,
				sc.name as category_name,
				CASE 
					WHEN i.fresh = 1 AND sc.name LIKE '%herb%' THEN 'Fresh herbs are best used quickly - these recipes share the same herb to prevent waste'
					WHEN i.fresh = 1 AND (sc.name LIKE '%fruit%' OR sc.name LIKE '%vege%') THEN 'Fresh produce pairs well across different cooking styles - use the whole ingredient across both dishes'
					ELSE 'These recipes share a key ingredient that works well when planned together'
				END as explanation,
				@row_number := CASE 
					WHEN @prev_ingredient = i.name THEN @row_number + 1 
					ELSE 1 
				END AS rn,
				@prev_ingredient := i.name
			FROM recipe_ingredients ri1
			JOIN recipes r1 ON ri1.recipe_id = r1.id
			INNER JOIN collections c1 ON r1.collection_id = c1.id
			JOIN ingredients i ON ri1.ingredient_id = i.id
			LEFT JOIN category_supermarket sc ON i.supermarketCategory_id = sc.id
			JOIN recipe_ingredients ri2 ON ri2.ingredient_id = i.id AND ri2.recipe_id != ri1.recipe_id
			JOIN recipes r2 ON ri2.recipe_id = r2.id
			INNER JOIN collections c2 ON r2.collection_id = c2.id
			CROSS JOIN (SELECT @row_number := 0, @prev_ingredient := '') AS vars
			WHERE r1.duplicate = 0 
				AND r2.duplicate = 0
				AND i.fresh = 1
				AND (sc.name IN ('fresh-fruitvege', 'fresh-herbs') 
					OR sc.name LIKE '%fruit%' 
					OR sc.name LIKE '%vege%'
					OR sc.name LIKE '%herb%')
				AND (
					ri1.quantity LIKE '%/%' 
					OR ri1.quantity LIKE '0.%'
					OR ri1.quantity < 1
					OR ri2.quantity LIKE '%/%'
					OR ri2.quantity LIKE '0.%' 
					OR ri2.quantity < 1
				)
				AND r1.id < r2.id
			ORDER BY 
				CASE 
					WHEN sc.name LIKE '%herb%' THEN 1
					WHEN sc.name LIKE '%fruit%' OR sc.name LIKE '%vege%' THEN 2
					ELSE 3
				END,
				i.name ASC,
				r1.name ASC
		) ranked
		WHERE rn <= 2
		ORDER BY 
			CASE 
				WHEN category_name LIKE '%herb%' THEN 1
				WHEN category_name LIKE '%fruit%' OR category_name LIKE '%vege%' THEN 2
				ELSE 3
			END,
			shared_ingredient ASC`
	);

	return rows;
}
