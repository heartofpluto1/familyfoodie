import pool from '../db.js';
import { QueryResult, Menu, PlannedMeal, Recipe } from '@/types/menus.js';

/**
 * Calculate week number from date
 */
function getWeekNumber(date: Date): number {
	const start = new Date(date.getFullYear(), 0, 1);
	const diff = date.getTime() - start.getTime();
	const oneWeek = 1000 * 60 * 60 * 24 * 7;
	return Math.floor(diff / oneWeek) + 1;
}

/**
 * Get recipe weeks from the last N months
 */
export async function getRecipeWeeks(months: number = 6): Promise<QueryResult> {
	// Calculate date range
	const monthsAgo = new Date();
	monthsAgo.setMonth(monthsAgo.getMonth() - months);

	const currentYear = new Date().getFullYear();
	const monthsAgoYear = monthsAgo.getFullYear();

	const monthsAgoWeek = getWeekNumber(monthsAgo);
	const currentWeek = getWeekNumber(new Date());

	const query = `
      SELECT 
        menus_recipeweek.id,
        week,
        year,
        recipe_id,
        filename,
        name as recipe_name
      FROM menus_recipeweek
      JOIN menus_recipe ON menus_recipeweek.recipe_id = menus_recipe.id
      WHERE 
        (year = ${currentYear} AND week <= ${currentWeek}) OR
        (year = ${monthsAgoYear} AND week >= ${monthsAgoWeek})
      ORDER BY year DESC, week DESC
    `;

	const [rows] = await pool.execute(query);
	const groupedWeeks = groupRecipesByWeek(rows as PlannedMeal[]);

	return {
		data: groupedWeeks,
		stats: getRecipeWeekStats(groupedWeeks),
	};
}

/**
 * Group recipe weeks by week and year
 */
export function groupRecipesByWeek(recipeWeeks: PlannedMeal[]): Menu[] {
	const grouped = recipeWeeks.reduce(
		(acc, recipeWeek) => {
			const key = `${recipeWeek.year}-${recipeWeek.week}`;

			if (!acc[key]) {
				acc[key] = {
					year: recipeWeek.year,
					week: recipeWeek.week,
					meals: [],
				};
			}

			acc[key].meals.push({
				id: recipeWeek.recipe_id,
				name: recipeWeek.recipe_name,
				filename: recipeWeek.filename,
			});

			return acc;
		},
		{} as Record<string, Menu>
	);

	// Convert to array
	return Object.values(grouped);
}

/**
 * Get statistics for recipe weeks
 */
export function getRecipeWeekStats(groupedWeeks: Menu[]) {
	const totalWeeks = groupedWeeks.length;
	const totalRecipes = groupedWeeks.reduce((sum, week) => sum + week.meals.length, 0);
	const avgRecipesPerWeek = totalWeeks > 0 ? (totalRecipes / totalWeeks).toFixed(1) : '0';

	return {
		totalWeeks,
		totalRecipes,
		avgRecipesPerWeek: parseFloat(avgRecipesPerWeek),
	};
}

/**
 * Get all recipes from the database
 */
export async function getAllRecipes(): Promise<Recipe[]> {
	const query = `
		SELECT
			id,
			name,
			filename,
			prepTime,
			cookTime
		FROM menus_recipe
		WHERE duplicate = 0
		ORDER BY name ASC
	`;

	const [rows] = await pool.execute(query);
	return rows as Recipe[];
}

interface RecipeRow {
	id: number;
	name: string;
	filename: string;
	prepTime?: number;
	cookTime?: number;
	description?: string;
	seasonName?: string;
	ingredients?: string;
}

/**
 * Get all recipes with related season and ingredient data for search functionality
 */
export async function getAllRecipesWithDetails(): Promise<Recipe[]> {
	const query = `
		SELECT DISTINCT
			r.id,
			r.name,
			r.filename,
			r.prepTime,
			r.cookTime,
			r.description,
			s.name as seasonName,
			GROUP_CONCAT(DISTINCT i.name SEPARATOR ', ') as ingredients
		FROM menus_recipe r
		LEFT JOIN menus_season s ON r.season_id = s.id
		LEFT JOIN menus_recipeingredient ri ON r.id = ri.recipe_id
		LEFT JOIN menus_ingredient i ON ri.ingredient_id = i.id
		WHERE r.duplicate = 0
		GROUP BY r.id, r.name, r.filename, r.prepTime, r.cookTime, r.description, s.name
		ORDER BY r.name ASC
	`;

	const [rows] = await pool.execute(query);
	const recipes = rows as RecipeRow[];

	return recipes.map(row => ({
		...row,
		ingredients: row.ingredients ? row.ingredients.split(', ') : [],
	}));
}
