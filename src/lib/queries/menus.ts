import pool from '../db.js';
import { QueryResult, Menu, PlannedMeal, Recipe, RecipeDetail } from '@/types/menus.js';

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

interface RecipeDetailRow {
	id: number;
	name: string;
	filename: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	seasonName?: string;
	ingredient_id?: number;
	quantity?: string;
	quantity4?: string;
	ingredient_table_id?: number;
	ingredient_name?: string;
	pantry_category_id?: number;
	pantry_category_name?: string;
	preperation_name?: string;
	measure_name?: string;
}

/**
 * Get current week number and year
 */
export function getCurrentWeek(): { week: number; year: number } {
	const now = new Date();
	return {
		week: getWeekNumber(now),
		year: now.getFullYear(),
	};
}

/**
 * Get next week number and year
 */
export function getNextWeek(): { week: number; year: number } {
	const now = new Date();
	// Add 7 days to get next week
	const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
	return {
		week: getWeekNumber(nextWeek),
		year: nextWeek.getFullYear(),
	};
}

/**
 * Get recipes for the current week
 */
export async function getCurrentWeekRecipes(): Promise<Recipe[]> {
	const { week, year } = getCurrentWeek();

	const query = `
		SELECT 
			r.id,
			r.name,
			r.filename,
			r.prepTime,
			r.cookTime,
			r.description
		FROM menus_recipeweek rw
		JOIN menus_recipe r ON rw.recipe_id = r.id
		WHERE rw.week = ? AND rw.year = ? AND rw.account_id = 1
		ORDER BY rw.id ASC
	`;

	const [rows] = await pool.execute(query, [week, year]);
	return rows as Recipe[];
}

/**
 * Get recipes for next week
 */
export async function getNextWeekRecipes(): Promise<Recipe[]> {
	const { week, year } = getNextWeek();

	const query = `
		SELECT 
			r.id,
			r.name,
			r.filename,
			r.prepTime,
			r.cookTime,
			r.description
		FROM menus_recipeweek rw
		JOIN menus_recipe r ON rw.recipe_id = r.id
		WHERE rw.week = ? AND rw.year = ? AND rw.account_id = 1
		ORDER BY rw.id ASC
	`;

	const [rows] = await pool.execute(query, [week, year]);
	return rows as Recipe[];
}

/**
 * Save recipes for a specific week
 */
export async function saveWeekRecipes(week: number, year: number, recipeIds: number[]): Promise<void> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		// Delete existing recipes for the week
		await connection.execute('DELETE FROM menus_recipeweek WHERE week = ? AND year = ? AND account_id = 1', [week, year]);

		// Insert new recipes
		if (recipeIds.length > 0) {
			const values = recipeIds.map(id => [week, year, id, 1]);
			const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
			const flatValues = values.flat();

			await connection.execute(`INSERT INTO menus_recipeweek (week, year, recipe_id, account_id) VALUES ${placeholders}`, flatValues);
		}

		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Delete all recipes for a specific week
 */
export async function deleteWeekRecipes(week: number, year: number): Promise<void> {
	await pool.execute('DELETE FROM menus_recipeweek WHERE week = ? AND year = ? AND account_id = 1', [week, year]);
}

/**
 * Get recipes for randomization (excluding recent weeks and with ingredient constraints)
 */
export async function getRecipesForRandomization(): Promise<Recipe[]> {
	const { year: currentYear } = getCurrentWeek();

	// Calculate 6 months ago
	const sixMonthsAgo = new Date();
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
	const sixMonthsAgoWeek = getWeekNumber(sixMonthsAgo);
	const sixMonthsAgoYear = sixMonthsAgo.getFullYear();

	const query = `
		SELECT DISTINCT
			r.id,
			r.name,
			r.filename,
			r.prepTime,
			r.cookTime,
			r.description,
			GROUP_CONCAT(DISTINCT i.name ORDER BY ri.id ASC SEPARATOR ', ') as ingredients
		FROM menus_recipe r
		LEFT JOIN menus_recipeingredient ri ON r.id = ri.recipe_id
		LEFT JOIN menus_ingredient i ON ri.ingredient_id = i.id
		WHERE r.duplicate = 0
		AND r.id NOT IN (
			SELECT DISTINCT recipe_id 
			FROM menus_recipeweek 
			WHERE ((year = ? AND week >= ?) OR (year > ? AND year <= ?)) AND account_id = 1
		)
		GROUP BY r.id, r.name, r.filename, r.prepTime, r.cookTime, r.description
		ORDER BY r.name ASC
	`;

	const [rows] = await pool.execute(query, [sixMonthsAgoYear, sixMonthsAgoWeek, sixMonthsAgoYear, currentYear]);

	const recipes = rows as (Recipe & { ingredients: string })[];
	return recipes.map(row => ({
		...row,
		ingredients: row.ingredients ? row.ingredients.split(', ') : [],
	}));
}

interface ShoppingIngredientRow {
	recipeIngredient_id: number;
	ingredient_id: number;
	quantity: string;
	quantity4: string;
	quantityMeasure_id: number | null;
	ingredient_name: string;
	pantryCategory_id: number | null;
	fresh: number;
	measure_name: string | null;
}

interface GroupedIngredient {
	recipeIngredient_id: number;
	ingredient_id: number;
	ingredient_name: string;
	quantity: number;
	quantity4: number;
	quantityMeasure_id: number | null;
	pantryCategory_id: number | null;
	fresh: number;
	measure_name: string | null;
}

/**
 * Reset and rebuild shopping list from planned recipes for a given week
 */
export async function resetShoppingListFromRecipes(week: number, year: number): Promise<void> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		// Delete existing shopping list items for the week
		await connection.execute('DELETE FROM menus_shoppinglist WHERE week = ? AND year = ? AND account_id = 1', [week, year]);

		// Get all ingredients from recipes planned for this week
		const ingredientsQuery = `
			SELECT 
				ri.id as recipeIngredient_id,
				ri.ingredient_id,
				ri.quantity,
				ri.quantity4,
				ri.quantityMeasure_id,
				i.name as ingredient_name,
				i.pantryCategory_id,
				i.fresh,
				m.name as measure_name
			FROM menus_recipeweek rw
			JOIN menus_recipeingredient ri ON rw.recipe_id = ri.recipe_id
			JOIN menus_ingredient i ON ri.ingredient_id = i.id
			LEFT JOIN menus_measure m ON ri.quantityMeasure_id = m.id
			WHERE rw.week = ? AND rw.year = ? AND rw.account_id = 1
		`;

		const [ingredientRows] = await connection.execute(ingredientsQuery, [week, year]);
		const ingredients = ingredientRows as ShoppingIngredientRow[];

		// Group ingredients by ingredient_id and sum quantities
		const groupedIngredients = ingredients.reduce((acc: Record<number, GroupedIngredient>, ingredient) => {
			const key = ingredient.ingredient_id;
			if (!acc[key]) {
				acc[key] = {
					recipeIngredient_id: ingredient.recipeIngredient_id,
					ingredient_id: ingredient.ingredient_id,
					ingredient_name: ingredient.ingredient_name,
					quantity: 0,
					quantity4: 0,
					quantityMeasure_id: ingredient.quantityMeasure_id,
					pantryCategory_id: ingredient.pantryCategory_id,
					fresh: ingredient.fresh,
					measure_name: ingredient.measure_name,
				};
			}
			acc[key].quantity += parseFloat(ingredient.quantity || '');
			acc[key].quantity4 += parseFloat(ingredient.quantity4 || '');
			return acc;
		}, {});

		// Insert grouped ingredients into shopping list
		if (Object.keys(groupedIngredients).length > 0) {
			const insertValues = Object.values(groupedIngredients).map((ingredient: GroupedIngredient) => [
				week,
				year,
				ingredient.fresh, // Use fresh value from menus_ingredient table
				ingredient.ingredient_name,
				0, // sort = 0 (default)
				null, // cost = null (default)
				ingredient.recipeIngredient_id,
				0, // purchased = false
				1, // account_id = 1
				null, // stockcode = null (default)
				null, // supermarketCategory_id = null (default)
			]);

			const placeholders = insertValues.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
			const flatValues = insertValues.flat();

			await connection.execute(
				`INSERT INTO menus_shoppinglist (week, year, fresh, name, sort, cost, recipeIngredient_id, purchased, account_id, stockcode, supermarketCategory_id) VALUES ${placeholders}`,
				flatValues
			);
		}

		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Get recipe details with ingredients ordered by pantry category
 */
export async function getRecipeDetails(id: string): Promise<RecipeDetail | null> {
	const query = `
		SELECT 
			r.id,
			r.name,
			r.filename,
			r.description,
			r.prepTime,
			r.cookTime,
			s.name as seasonName,
			ri.id as ingredient_id,
			ri.quantity,
			ri.quantity4,
			i.id as ingredient_table_id,
			i.name as ingredient_name,
			pc.id as pantry_category_id,
			pc.name as pantry_category_name,
			p.name as preperation_name,
			m.name as measure_name
		FROM menus_recipe r
		LEFT JOIN menus_season s ON r.season_id = s.id
		LEFT JOIN menus_recipeingredient ri ON r.id = ri.recipe_id
		LEFT JOIN menus_ingredient i ON ri.ingredient_id = i.id
		LEFT JOIN menus_pantrycategory pc ON i.pantryCategory_id = pc.id
		LEFT JOIN menus_preperation p ON ri.preperation_id = p.id
		LEFT JOIN menus_measure m ON ri.quantityMeasure_id = m.id
		WHERE r.id = ? AND r.duplicate = 0
		ORDER BY pc.id ASC, i.name ASC
	`;

	const [rows] = await pool.execute(query, [id]);
	const results = rows as RecipeDetailRow[];

	if (results.length === 0) {
		return null;
	}

	const recipe = results[0];
	const ingredients = results
		.filter(
			row =>
				row.ingredient_id !== null &&
				row.ingredient_id !== undefined &&
				row.quantity !== null &&
				row.quantity !== undefined &&
				row.quantity4 !== null &&
				row.quantity4 !== undefined &&
				row.ingredient_table_id !== null &&
				row.ingredient_table_id !== undefined &&
				row.ingredient_name !== null &&
				row.ingredient_name !== undefined &&
				row.pantry_category_id !== null &&
				row.pantry_category_id !== undefined &&
				row.pantry_category_name !== null &&
				row.pantry_category_name !== undefined
		)
		.map(row => ({
			id: row.ingredient_id!,
			quantity: row.quantity!,
			quantity4: row.quantity4!,
			ingredient: {
				id: row.ingredient_table_id!,
				name: row.ingredient_name!,
				pantryCategory: {
					id: row.pantry_category_id!,
					name: row.pantry_category_name!,
				},
			},
			preperation: row.preperation_name ? { name: row.preperation_name } : undefined,
			measure: row.measure_name ? { name: row.measure_name } : undefined,
		}));

	return {
		id: recipe.id,
		name: recipe.name,
		filename: recipe.filename,
		description: recipe.description || '',
		prepTime: recipe.prepTime,
		cookTime: recipe.cookTime,
		seasonName: recipe.seasonName,
		ingredients,
	};
}
