import pool from './db.js';

export type QueryResult = {
	data: Menu[];
	stats?: Stats;
	error?: string;
	success: boolean;
};

export interface Menu {
	year: number;
	week: number;
	meals: Meal[];
}

export interface Stats {
	totalWeeks: number;
	totalRecipes: number;
	avgRecipesPerWeek: number;
}

export interface PlannedMeal {
	id: number;
	week: number;
	year: number;
	recipe_id: number;
	recipe_name: string;
	filename: string;
}

export interface Meal {
	id: number;
	name: string;
	filename: string;
}

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
	try {
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
			success: true,
		};
	} catch (error) {
		return {
			data: [],
			error: error instanceof Error ? error.message : 'Unknown database error occurred',
			success: false,
		};
	}
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
