import pool from '@/lib/db.js';
import { QueryResult, Menu, PlannedMeal, Recipe, RecipeDetail } from '@/types/menus.js';

/**
 * Calculate ISO week number from date
 */
function getWeekNumber(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
        plans.id,
        plans.week,
        plans.year,
        plans.recipe_id,
        recipes.filename,
        recipes.name as recipe_name,
        recipes.url_slug,
        recipes.collection_id,
        c.title as collection_title,
        c.url_slug as collection_url_slug
      FROM plans
      JOIN recipes ON plans.recipe_id = recipes.id
      INNER JOIN collections c ON recipes.collection_id = c.id
      WHERE 
        ((plans.year = ${currentYear} AND plans.week <= ${currentWeek}) OR
        (plans.year = ${monthsAgoYear} AND plans.week >= ${monthsAgoWeek}))
      ORDER BY plans.year DESC, plans.week DESC
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
				collection_id: recipeWeek.collection_id,
				collection_title: recipeWeek.collection_title,
				url_slug: recipeWeek.url_slug,
				collection_url_slug: recipeWeek.collection_url_slug,
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
 * Get all recipes from the database, optionally filtered by collection
 */
export async function getAllRecipes(collectionId?: number): Promise<Recipe[]> {
	let query = `
		SELECT
			r.id,
			r.name,
			r.filename,
			r.prepTime,
			r.cookTime,
			r.url_slug,
			r.collection_id,
			c.title as collection_title,
			c.url_slug as collection_url_slug
		FROM recipes r
		INNER JOIN collections c ON r.collection_id = c.id
		WHERE r.duplicate = 0
	`;

	const params: (string | number)[] = [];

	if (collectionId) {
		query += ` AND r.collection_id = ?`;
		params.push(collectionId);
	}

	query += ` ORDER BY r.name ASC`;

	const [rows] = await pool.execute(query, params);
	return rows as Recipe[];
}

interface RecipeRow {
	id: number;
	name: string;
	filename: string;
	prepTime?: number;
	cookTime?: number;
	description?: string;
	url_slug?: string;
	collection_id: number;
	collection_title: string;
	collection_url_slug?: string;
	seasonName?: string;
	ingredients?: string;
}

/**
 * Get all recipes with related season and ingredient data for search functionality
 * Optionally filtered by collection
 */
export async function getAllRecipesWithDetails(collectionId?: number): Promise<Recipe[]> {
	let query = `
		SELECT DISTINCT
			r.id,
			r.name,
			r.filename,
			r.prepTime,
			r.cookTime,
			r.description,
			r.url_slug,
			r.collection_id,
			c.title as collection_title,
			c.url_slug as collection_url_slug,
			s.name as seasonName,
			GROUP_CONCAT(DISTINCT i.name SEPARATOR ', ') as ingredients
		FROM recipes r
		INNER JOIN collections c ON r.collection_id = c.id
		LEFT JOIN seasons s ON r.season_id = s.id
		LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
		LEFT JOIN ingredients i ON ri.ingredient_id = i.id
		WHERE r.duplicate = 0
	`;

	const params: (string | number)[] = [];

	if (collectionId) {
		query += ` AND r.collection_id = ?`;
		params.push(collectionId);
	}

	query += ` GROUP BY r.id, r.name, r.filename, r.prepTime, r.cookTime, r.description, r.url_slug, r.collection_id, c.title, c.url_slug, s.name
		ORDER BY r.name ASC`;

	const [rows] = await pool.execute(query, params);
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
	url_slug?: string;
	collection_id: number;
	collection_title: string;
	collection_url_slug?: string;
	seasonName?: string;
	primaryTypeName?: string;
	secondaryTypeName?: string;
	ingredient_id?: number;
	quantity?: string;
	quantity4?: string;
	ingredient_table_id?: number;
	ingredient_name?: string;
	pantry_category_id?: number;
	pantry_category_name?: string;
	preperation_name?: string;
	measure_id?: number;
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
			r.description,
			r.url_slug,
			r.collection_id,
			c.title as collection_title,
			c.url_slug as collection_url_slug
		FROM plans rw
		JOIN recipes r ON rw.recipe_id = r.id
		INNER JOIN collections c ON r.collection_id = c.id
		WHERE rw.week = ? AND rw.year = ? 
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
			r.description,
			r.url_slug
		FROM plans rw
		JOIN recipes r ON rw.recipe_id = r.id
		WHERE rw.week = ? AND rw.year = ? 
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
		await connection.execute('DELETE FROM plans WHERE week = ? AND year = ?', [week, year]);

		// Insert new recipes
		if (recipeIds.length > 0) {
			const values = recipeIds.map(id => [week, year, id]);
			const placeholders = values.map(() => '(?, ?, ?)').join(', ');
			const flatValues = values.flat();

			await connection.execute(`INSERT INTO plans (week, year, recipe_id) VALUES ${placeholders}`, flatValues);
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
	await pool.execute('DELETE FROM plans WHERE week = ? AND year = ?', [week, year]);
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
			r.url_slug,
			GROUP_CONCAT(DISTINCT i.name ORDER BY ri.id ASC SEPARATOR ', ') as ingredients
		FROM recipes r
		LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
		LEFT JOIN ingredients i ON ri.ingredient_id = i.id
		WHERE r.duplicate = 0 
		  AND r.id NOT IN (
			SELECT DISTINCT recipe_id 
			FROM plans 
			WHERE ((year = ? AND week >= ?) OR (year > ? AND year <= ?))		  )
		GROUP BY r.id, r.name, r.filename, r.prepTime, r.cookTime, r.description, r.url_slug
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
	supermarketCategory_id: number | null;
	fresh: number;
	cost: number | null;
	stockcode: string | null;
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
	supermarketCategory_id: number | null;
	fresh: number;
	cost: number | null;
	stockcode: string | null;
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
		await connection.execute('DELETE FROM shopping_lists WHERE week = ? AND year = ?', [week, year]);

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
				i.supermarketCategory_id,
				i.fresh,
				i.cost,
				i.stockcode,
				m.name as measure_name
			FROM plans rw
			JOIN recipe_ingredients ri ON rw.recipe_id = ri.recipe_id
			JOIN recipes r ON rw.recipe_id = r.id
			JOIN ingredients i ON ri.ingredient_id = i.id
			LEFT JOIN measurements m ON ri.quantityMeasure_id = m.id
			WHERE rw.week = ? AND rw.year = ?			ORDER BY 
				CASE 
					WHEN i.fresh = 1 THEN i.supermarketCategory_id
					WHEN i.fresh = 0 THEN i.pantryCategory_id
					ELSE 999
				END,
				i.name
		`;

		const [ingredientRows] = await connection.execute(ingredientsQuery, [week, year]);
		const ingredients = ingredientRows as ShoppingIngredientRow[];

		// Group ingredients by ingredient_id AND quantityMeasure_id (only group if same ingredient with same measurement)
		const groupedIngredients = ingredients.reduce((acc: Record<string, GroupedIngredient>, ingredient) => {
			// Create composite key from ingredient_id and quantityMeasure_id to ensure we only group same ingredients with same measurements
			const key = `${ingredient.ingredient_id}-${ingredient.quantityMeasure_id || 'null'}`;
			if (!acc[key]) {
				acc[key] = {
					recipeIngredient_id: ingredient.recipeIngredient_id,
					ingredient_id: ingredient.ingredient_id,
					ingredient_name: ingredient.ingredient_name,
					quantity: 0,
					quantity4: 0,
					quantityMeasure_id: ingredient.quantityMeasure_id,
					pantryCategory_id: ingredient.pantryCategory_id,
					supermarketCategory_id: ingredient.supermarketCategory_id,
					fresh: ingredient.fresh,
					cost: ingredient.cost,
					stockcode: ingredient.stockcode,
					measure_name: ingredient.measure_name,
				};
			}
			acc[key].quantity += parseFloat(ingredient.quantity || '');
			acc[key].quantity4 += parseFloat(ingredient.quantity4 || '');
			return acc;
		}, {});

		// Insert grouped ingredients into shopping list
		if (Object.keys(groupedIngredients).length > 0) {
			const insertValues = Object.values(groupedIngredients).map((ingredient: GroupedIngredient, index: number) => [
				week,
				year,
				ingredient.fresh, // Use fresh value from ingredients table
				ingredient.ingredient_name,
				index, // sort = increasing integer
				ingredient.cost, // cost from ingredients table
				ingredient.recipeIngredient_id,
				0, // purchased = false
				ingredient.stockcode, // stockcode from ingredients table
				ingredient.supermarketCategory_id, // supermarketCategory_id from ingredients table
			]);

			const placeholders = insertValues.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
			const flatValues = insertValues.flat();

			await connection.execute(
				`INSERT INTO shopping_lists (week, year, fresh, name, sort, cost, recipeIngredient_id, purchased, stockcode, supermarketCategory_id) VALUES ${placeholders}`,
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
			r.url_slug,
			r.collection_id,
			c.title as collection_title,
			c.url_slug as collection_url_slug,
			s.name as seasonName,
			pt.name as primaryTypeName,
			st.name as secondaryTypeName,
			ri.id as ingredient_id,
			ri.quantity,
			ri.quantity4,
			i.id as ingredient_table_id,
			i.name as ingredient_name,
			pc.id as pantry_category_id,
			pc.name as pantry_category_name,
			p.name as preperation_name,
			m.id as measure_id,
			m.name as measure_name
		FROM recipes r
		INNER JOIN collections c ON r.collection_id = c.id
		LEFT JOIN seasons s ON r.season_id = s.id
		LEFT JOIN type_proteins pt ON r.primaryType_id = pt.id
		LEFT JOIN type_carbs st ON r.secondaryType_id = st.id
		LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
		LEFT JOIN ingredients i ON ri.ingredient_id = i.id
		LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
		LEFT JOIN preparations p ON ri.preperation_id = p.id
		LEFT JOIN measurements m ON ri.quantityMeasure_id = m.id
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
			measure: row.measure_name ? { id: row.measure_id!, name: row.measure_name } : undefined,
		}));

	return {
		id: recipe.id,
		name: recipe.name,
		filename: recipe.filename,
		description: recipe.description || '',
		prepTime: recipe.prepTime,
		cookTime: recipe.cookTime,
		url_slug: recipe.url_slug,
		collection_id: recipe.collection_id,
		collection_title: recipe.collection_title,
		collection_url_slug: recipe.collection_url_slug,
		seasonName: recipe.seasonName,
		primaryTypeName: recipe.primaryTypeName,
		secondaryTypeName: recipe.secondaryTypeName,
		ingredients,
	};
}

/**
 * Get all planned weeks from current week forward
 */
export async function getAllPlannedWeeks(): Promise<Array<{ week: number; year: number; recipes: Recipe[] }>> {
	const { week: currentWeek, year: currentYear } = getCurrentWeek();

	// Get all planned weeks from current week forward (including next year)
	const query = `
		SELECT DISTINCT rw.week, rw.year
		FROM plans rw
		WHERE 1=1
		AND (
			(rw.year = ? AND rw.week >= ?) OR
			(rw.year > ?)
		)
		ORDER BY rw.year ASC, rw.week ASC
	`;

	const [weekRows] = await pool.execute(query, [currentYear, currentWeek, currentYear]);
	const plannedWeeks = weekRows as Array<{ week: number; year: number }>;

	// Fetch recipes for each planned week
	const weeksWithRecipes = await Promise.all(
		plannedWeeks.map(async ({ week, year }) => {
			const recipesQuery = `
				SELECT 
					r.id,
					r.name,
					r.filename,
					r.prepTime,
					r.cookTime,
					r.description,
					r.url_slug
				FROM plans rw
				JOIN recipes r ON rw.recipe_id = r.id
				WHERE rw.week = ? AND rw.year = ?
				ORDER BY rw.id ASC
			`;

			const [recipeRows] = await pool.execute(recipesQuery, [week, year]);
			const recipes = recipeRows as Recipe[];

			return { week, year, recipes };
		})
	);

	return weeksWithRecipes;
}

/**
 * Get current week recipes and all planned future weeks
 */
export async function getCurrentAndPlannedWeeks(): Promise<Array<{ week: number; year: number; recipes: Recipe[] }>> {
	const { week: currentWeek, year: currentYear } = getCurrentWeek();

	// First get current week recipes
	const currentWeekRecipes = await getCurrentWeekRecipes();

	// Then get all planned weeks
	const plannedWeeks = await getAllPlannedWeeks();

	// Check if current week is already in planned weeks
	const currentWeekExists = plannedWeeks.some(w => w.week === currentWeek && w.year === currentYear);

	if (currentWeekExists) {
		return plannedWeeks;
	} else {
		// Add current week at the beginning if it's not already planned
		return [{ week: currentWeek, year: currentYear, recipes: currentWeekRecipes }, ...plannedWeeks];
	}
}
