import { PoolConnection, ResultSetHeader } from 'mysql2/promise';

/**
 * Database query utilities for copy-on-write operations
 * Handles all database interactions for household resource copying
 */

export interface Recipe {
	id: number;
	name: string;
	prepTime: number | null;
	cookTime: number | null;
	description: string | null;
	archived: number;
	season_id: number | null;
	primaryType_id: number | null;
	secondaryType_id: number | null;
	public: number;
	url_slug: string;
	image_filename: string | null;
	pdf_filename: string | null;
	household_id: number;
	parent_id: number | null;
}

export interface Collection {
	id: number;
	title: string;
	subtitle: string | null;
	filename: string | null;
	filename_dark: string | null;
	household_id: number;
	parent_id: number | null;
	public: number;
	url_slug: string;
}

export interface Ingredient {
	id: number;
	name: string;
	fresh: number;
	supermarketCategory_id: number | null;
	cost: number | null;
	stockcode: string | null;
	public: number;
	pantryCategory_id: number | null;
	household_id: number;
	parent_id: number | null;
}

export interface RecipeIngredient {
	id: number;
	quantity: string | null;
	ingredient_id: number;
	recipe_id: number;
	preperation_id: number | null;
	primaryIngredient: number;
	quantity4: string | null;
	quantityMeasure_id: number | null;
	parent_id: number | null;
}

/**
 * Get recipe by ID with household info
 */
export async function getRecipeById(connection: PoolConnection, recipeId: number): Promise<Recipe | null> {
	const [rows] = await connection.execute(
		`
    SELECT id, name, prepTime, cookTime, description, archived, season_id, 
           primaryType_id, secondaryType_id, public, url_slug, image_filename, 
           pdf_filename, household_id, parent_id
    FROM recipes 
    WHERE id = ?
  `,
		[recipeId]
	);

	const recipes = rows as Recipe[];
	return recipes.length > 0 ? recipes[0] : null;
}

/**
 * Get collection by ID with household info
 */
export async function getCollectionById(connection: PoolConnection, collectionId: number): Promise<Collection | null> {
	const [rows] = await connection.execute(
		`
    SELECT id, title, subtitle, filename, filename_dark, household_id, 
           parent_id, public, url_slug
    FROM collections 
    WHERE id = ?
  `,
		[collectionId]
	);

	const collections = rows as Collection[];
	return collections.length > 0 ? collections[0] : null;
}

/**
 * Get ingredient by ID with household info
 */
export async function getIngredientById(connection: PoolConnection, ingredientId: number): Promise<Ingredient | null> {
	const [rows] = await connection.execute(
		`
    SELECT id, name, fresh, supermarketCategory_id, cost, stockcode, 
           public, pantryCategory_id, household_id, parent_id
    FROM ingredients 
    WHERE id = ?
  `,
		[ingredientId]
	);

	const ingredients = rows as Ingredient[];
	return ingredients.length > 0 ? ingredients[0] : null;
}

/**
 * Copy a recipe to a new household
 */
export async function copyRecipe(connection: PoolConnection, recipe: Recipe, newHouseholdId: number): Promise<number> {
	const [result] = await connection.execute(
		`
    INSERT INTO recipes (name, prepTime, cookTime, description, archived, season_id, 
                        primaryType_id, secondaryType_id, public, url_slug, 
                        image_filename, pdf_filename, household_id, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
		[
			recipe.name,
			recipe.prepTime,
			recipe.cookTime,
			recipe.description,
			recipe.archived,
			recipe.season_id,
			recipe.primaryType_id,
			recipe.secondaryType_id,
			recipe.public,
			recipe.url_slug,
			recipe.image_filename,
			recipe.pdf_filename,
			newHouseholdId,
			recipe.id, // parent_id
		]
	);

	return (result as ResultSetHeader).insertId;
}

/**
 * Copy all recipe ingredients for a recipe
 */
export async function copyRecipeIngredients(connection: PoolConnection, originalRecipeId: number, newRecipeId: number): Promise<void> {
	await connection.execute(
		`
    INSERT INTO recipe_ingredients (quantity, ingredient_id, recipe_id, preperation_id, 
                                   primaryIngredient, quantity4, quantityMeasure_id, parent_id)
    SELECT quantity, ingredient_id, ?, preperation_id,
           primaryIngredient, quantity4, quantityMeasure_id, id
    FROM recipe_ingredients WHERE recipe_id = ?
  `,
		[newRecipeId, originalRecipeId]
	);
}

/**
 * Copy a collection to a new household
 */
export async function copyCollection(connection: PoolConnection, collection: Collection, newHouseholdId: number): Promise<number> {
	const [result] = await connection.execute(
		`
    INSERT INTO collections (title, subtitle, filename, filename_dark, household_id, parent_id, public, url_slug)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
		[
			`${collection.title} (Copy)`,
			collection.subtitle,
			collection.filename,
			collection.filename_dark,
			newHouseholdId,
			collection.id, // parent_id
			0, // private by default
			collection.url_slug,
		]
	);

	return (result as ResultSetHeader).insertId;
}

/**
 * Copy all collection recipes to a new collection
 */
export async function copyCollectionRecipes(connection: PoolConnection, originalCollectionId: number, newCollectionId: number): Promise<void> {
	await connection.execute(
		`
    INSERT INTO collection_recipes (collection_id, recipe_id, added_at, display_order)
    SELECT ?, recipe_id, NOW(), display_order
    FROM collection_recipes
    WHERE collection_id = ?
  `,
		[newCollectionId, originalCollectionId]
	);
}

/**
 * Copy an ingredient to a new household
 */
export async function copyIngredient(connection: PoolConnection, ingredient: Ingredient, newHouseholdId: number): Promise<number> {
	const [result] = await connection.execute(
		`
    INSERT INTO ingredients (name, fresh, supermarketCategory_id, cost, stockcode, 
                           public, pantryCategory_id, household_id, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
		[
			ingredient.name,
			ingredient.fresh,
			ingredient.supermarketCategory_id,
			ingredient.cost,
			ingredient.stockcode,
			ingredient.public,
			ingredient.pantryCategory_id,
			newHouseholdId,
			ingredient.id, // parent_id
		]
	);

	return (result as ResultSetHeader).insertId;
}

/**
 * Update junction table to reference new recipe in household's collections
 */
export async function updateJunctionTableForRecipe(connection: PoolConnection, oldRecipeId: number, newRecipeId: number, householdId: number): Promise<void> {
	await connection.execute(
		`
    UPDATE collection_recipes cr
    JOIN collections c ON cr.collection_id = c.id
    SET cr.recipe_id = ?
    WHERE c.household_id = ? AND cr.recipe_id = ?
  `,
		[newRecipeId, householdId, oldRecipeId]
	);
}

/**
 * Update junction table to reference new recipe in a specific collection
 */
export async function updateJunctionTableForCollectionRecipe(
	connection: PoolConnection,
	collectionId: number,
	oldRecipeId: number,
	newRecipeId: number
): Promise<void> {
	await connection.execute(
		`
    UPDATE collection_recipes 
    SET recipe_id = ?
    WHERE collection_id = ? AND recipe_id = ?
  `,
		[newRecipeId, collectionId, oldRecipeId]
	);
}

/**
 * Update all recipe_ingredients in household's recipes to use new ingredient
 */
export async function updateRecipeIngredientsForHousehold(
	connection: PoolConnection,
	oldIngredientId: number,
	newIngredientId: number,
	householdId: number
): Promise<void> {
	await connection.execute(
		`
    UPDATE recipe_ingredients ri
    JOIN recipes r ON ri.recipe_id = r.id
    SET ri.ingredient_id = ?
    WHERE r.household_id = ? AND ri.ingredient_id = ?
  `,
		[newIngredientId, householdId, oldIngredientId]
	);
}

/**
 * Remove subscription from original collection
 */
export async function removeCollectionSubscription(connection: PoolConnection, householdId: number, collectionId: number): Promise<void> {
	await connection.execute(
		`
    DELETE FROM collection_subscriptions 
    WHERE household_id = ? AND collection_id = ?
  `,
		[householdId, collectionId]
	);
}

/**
 * Find and delete orphaned household-owned ingredients
 */
export async function deleteOrphanedIngredients(connection: PoolConnection, householdId: number, excludeRecipeId?: number): Promise<number[]> {
	// First, find ingredients that are orphaned
	let query = `
    SELECT DISTINCT i.id
    FROM ingredients i
    WHERE i.household_id = ?
    AND i.id NOT IN (
      SELECT DISTINCT ri.ingredient_id 
      FROM recipe_ingredients ri
      JOIN recipes r ON ri.recipe_id = r.id
      WHERE r.household_id = ?
  `;

	const params: (number | string)[] = [householdId, householdId];

	if (excludeRecipeId) {
		query += ' AND r.id != ?';
		params.push(excludeRecipeId);
	}

	query += ')';

	const [rows] = await connection.execute(query, params);
	const orphanedIds = (rows as Array<{ id: number }>).map(row => row.id);

	if (orphanedIds.length > 0) {
		// Delete the orphaned ingredients
		await connection.execute(
			`
      DELETE FROM ingredients 
      WHERE id IN (${orphanedIds.map(() => '?').join(',')})
    `,
			orphanedIds
		);
	}

	return orphanedIds;
}

/**
 * Delete recipe_ingredients for a specific recipe
 */
export async function deleteRecipeIngredients(connection: PoolConnection, recipeId: number): Promise<number> {
	const [result] = await connection.execute(
		`
    DELETE FROM recipe_ingredients 
    WHERE recipe_id = ?
  `,
		[recipeId]
	);

	return (result as ResultSetHeader).affectedRows;
}
