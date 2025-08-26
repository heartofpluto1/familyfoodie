import pool from '@/lib/db.js';
import { PoolConnection } from 'mysql2/promise';
import {
	getRecipeById,
	getCollectionById,
	getIngredientById,
	copyRecipe,
	copyRecipeIngredients,
	copyCollection,
	copyCollectionRecipes,
	copyIngredient,
	updateJunctionTableForRecipe,
	updateJunctionTableForCollectionRecipe,
	updateRecipeIngredientsForHousehold,
	removeCollectionSubscription,
	deleteOrphanedIngredients,
	deleteRecipeIngredients,
} from '@/lib/queries/copy-operations';

/**
 * Main copy-on-write functions for household resource isolation
 * Implements the same logic as the original stored procedures but in TypeScript
 */

export interface CopyResult {
	copied: boolean;
	newId: number;
}

export interface CascadeCopyResult {
	newCollectionId: number;
	newRecipeId: number;
	actionsTaken: string[];
}

export interface FullCascadeCopyResult extends CascadeCopyResult {
	newIngredientId: number;
}

/**
 * Copy a recipe for editing if the household doesn't own it
 * Equivalent to the original CopyRecipeForEdit stored procedure
 */
export async function copyRecipeForEdit(recipeId: number, householdId: number): Promise<CopyResult> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		// Get the recipe with ownership info
		const recipe = await getRecipeById(connection, recipeId);
		if (!recipe) {
			throw new Error(`Recipe with ID ${recipeId} not found`);
		}

		// Check if recipe is already owned by this household
		if (recipe.household_id === householdId) {
			await connection.commit();
			return { copied: false, newId: recipeId };
		}

		// Copy recipe for this household
		const newRecipeId = await copyRecipe(connection, recipe, householdId);

		// Copy all recipe_ingredients
		await copyRecipeIngredients(connection, recipeId, newRecipeId);

		// Update junction table to reference new recipe in household's collections
		await updateJunctionTableForRecipe(connection, recipeId, newRecipeId, householdId);

		await connection.commit();
		return { copied: true, newId: newRecipeId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Copy an ingredient for editing if the household doesn't own it
 * Equivalent to the original CopyIngredientForEdit stored procedure
 */
export async function copyIngredientForEdit(ingredientId: number, householdId: number): Promise<CopyResult> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		// Get the ingredient with ownership info
		const ingredient = await getIngredientById(connection, ingredientId);
		if (!ingredient) {
			throw new Error(`Ingredient with ID ${ingredientId} not found`);
		}

		// Check if ingredient is already owned by this household
		if (ingredient.household_id === householdId) {
			await connection.commit();
			return { copied: false, newId: ingredientId };
		}

		// Copy ingredient for this household
		const newIngredientId = await copyIngredient(connection, ingredient, householdId);

		// Update all recipe_ingredients in household's recipes to use new ingredient
		await updateRecipeIngredientsForHousehold(connection, ingredientId, newIngredientId, householdId);

		await connection.commit();
		return { copied: true, newId: newIngredientId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Cascade copy collection and recipe with context awareness
 * Equivalent to the original CascadeCopyWithContext stored procedure
 */
export async function cascadeCopyWithContext(householdId: number, collectionId: number, recipeId: number): Promise<CascadeCopyResult> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		const actionsTaken: string[] = [];
		let newCollectionId = collectionId;
		let newRecipeId = recipeId;

		// Get collection and recipe with ownership info
		const collection = await getCollectionById(connection, collectionId);
		const recipe = await getRecipeById(connection, recipeId);

		if (!collection) {
			throw new Error(`Collection with ID ${collectionId} not found`);
		}
		if (!recipe) {
			throw new Error(`Recipe with ID ${recipeId} not found`);
		}

		// Copy collection if not owned by user's household
		if (collection.household_id !== householdId) {
			newCollectionId = await copyCollection(connection, collection, householdId);
			actionsTaken.push('collection_copied');

			// Copy junction table entries to new collection
			await copyCollectionRecipes(connection, collectionId, newCollectionId);

			// Unsubscribe from original collection since we now have our own copy
			await removeCollectionSubscription(connection, householdId, collectionId);
			actionsTaken.push('unsubscribed_from_original');
		}

		// Copy recipe if not owned by user's household
		if (recipe.household_id !== householdId) {
			// Use the copyRecipeForEdit logic but within this transaction
			const copiedRecipeId = await copyRecipe(connection, recipe, householdId);
			await copyRecipeIngredients(connection, recipeId, copiedRecipeId);
			newRecipeId = copiedRecipeId;
			actionsTaken.push('recipe_copied');

			// Update junction table to point to new recipe in user's collection
			await updateJunctionTableForCollectionRecipe(connection, newCollectionId, recipeId, newRecipeId);
		}

		await connection.commit();
		return {
			newCollectionId,
			newRecipeId,
			actionsTaken,
		};
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Full cascade copy including ingredient with collection/recipe context
 * Equivalent to the original CascadeCopyIngredientWithContext stored procedure
 */
export async function cascadeCopyIngredientWithContext(
	householdId: number,
	collectionId: number,
	recipeId: number,
	ingredientId: number
): Promise<FullCascadeCopyResult> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		// First ensure collection and recipe are owned/copied
		const cascadeResult = await cascadeCopyWithContextInTransaction(connection, householdId, collectionId, recipeId);

		let newIngredientId = ingredientId;
		const actionsTaken = [...cascadeResult.actionsTaken];

		// Then handle ingredient copying
		const ingredient = await getIngredientById(connection, ingredientId);
		if (!ingredient) {
			throw new Error(`Ingredient with ID ${ingredientId} not found`);
		}

		if (ingredient.household_id !== householdId) {
			newIngredientId = await copyIngredient(connection, ingredient, householdId);
			await updateRecipeIngredientsForHousehold(connection, ingredientId, newIngredientId, householdId);
			actionsTaken.push('ingredient_copied');
		}

		await connection.commit();
		return {
			newCollectionId: cascadeResult.newCollectionId,
			newRecipeId: cascadeResult.newRecipeId,
			newIngredientId,
			actionsTaken,
		};
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Internal helper for cascade copy that reuses existing transaction
 */
async function cascadeCopyWithContextInTransaction(
	connection: PoolConnection,
	householdId: number,
	collectionId: number,
	recipeId: number
): Promise<CascadeCopyResult> {
	const actionsTaken: string[] = [];
	let newCollectionId = collectionId;
	let newRecipeId = recipeId;

	// Get collection and recipe with ownership info
	const collection = await getCollectionById(connection, collectionId);
	const recipe = await getRecipeById(connection, recipeId);

	if (!collection) {
		throw new Error(`Collection with ID ${collectionId} not found`);
	}
	if (!recipe) {
		throw new Error(`Recipe with ID ${recipeId} not found`);
	}

	// Copy collection if not owned by user's household
	if (collection.household_id !== householdId) {
		newCollectionId = await copyCollection(connection, collection, householdId);
		actionsTaken.push('collection_copied');

		// Copy junction table entries to new collection
		await copyCollectionRecipes(connection, collectionId, newCollectionId);

		// Unsubscribe from original collection since we now have our own copy
		await removeCollectionSubscription(connection, householdId, collectionId);
		actionsTaken.push('unsubscribed_from_original');
	}

	// Copy recipe if not owned by user's household
	if (recipe.household_id !== householdId) {
		const copiedRecipeId = await copyRecipe(connection, recipe, householdId);
		await copyRecipeIngredients(connection, recipeId, copiedRecipeId);
		newRecipeId = copiedRecipeId;
		actionsTaken.push('recipe_copied');

		// Update junction table to point to new recipe in user's collection
		await updateJunctionTableForCollectionRecipe(connection, newCollectionId, recipeId, newRecipeId);
	}

	return {
		newCollectionId,
		newRecipeId,
		actionsTaken,
	};
}

/**
 * Clean up orphaned household-owned ingredients after recipe deletion
 * Replaces the cleanup_after_recipe_delete trigger
 */
export async function cleanupOrphanedIngredients(householdId: number, deletedRecipeId: number): Promise<{ deletedIngredientIds: number[] }> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		// Find and delete orphaned ingredients
		const deletedIngredientIds = await deleteOrphanedIngredients(connection, householdId, deletedRecipeId);

		await connection.commit();
		return { deletedIngredientIds };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Clean up recipe_ingredients entries after recipe deletion
 * Part of the cleanup logic that replaces the trigger
 */
export async function cleanupOrphanedRecipeIngredients(recipeId: number): Promise<{ deletedCount: number }> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		const deletedCount = await deleteRecipeIngredients(connection, recipeId);

		await connection.commit();
		return { deletedCount };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

/**
 * Complete cleanup after recipe deletion - combines both cleanup functions
 * This should be called from recipe deletion API endpoints
 */
export async function performCompleteCleanupAfterRecipeDelete(
	recipeId: number,
	householdId: number
): Promise<{ deletedRecipeIngredients: number; deletedOrphanedIngredients: number[] }> {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		// Clean up recipe_ingredients for this recipe
		const deletedRecipeIngredients = await deleteRecipeIngredients(connection, recipeId);

		// Clean up orphaned household-owned ingredients
		const deletedOrphanedIngredients = await deleteOrphanedIngredients(connection, householdId, recipeId);

		await connection.commit();
		return {
			deletedRecipeIngredients,
			deletedOrphanedIngredients,
		};
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
