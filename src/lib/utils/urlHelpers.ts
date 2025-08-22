/**
 * URL slug generation utilities for creating SEO-friendly URLs
 * Format: {id}-{slug} where ID is used for lookups and slug is for readability
 */

import type { Recipe } from '@/types/menus';

/**
 * Generates a URL-safe slug path from an ID and url_slug
 * @param id - The numeric ID of the resource
 * @param urlSlug - The pre-generated URL slug from database
 * @returns A string in format "{id}-{slug}"
 * @example generateSlugPath(42, "italian-classics") => "42-italian-classics"
 */
export function generateSlugPath(id: number, urlSlug: string): string {
	// Use the pre-generated url_slug from database
	// If urlSlug is empty or undefined, fallback to basic slug
	if (!urlSlug || urlSlug.trim() === '') {
		return `${id}-untitled`;
	}
	return `${id}-${urlSlug}`;
}

/**
 * Legacy function for generating slugs from titles (used for migration/fallback)
 * @param id - The numeric ID of the resource
 * @param title - The human-readable title to convert to slug
 * @returns A string in format "{id}-{slug}"
 * @example generateSlugFromTitle(42, "Italian Classics") => "42-italian-classics"
 */
export function generateSlugFromTitle(id: number, title: string): string {
	// Convert title to URL-safe slug (internal implementation)
	const slug = title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '') // Remove special characters
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/--+/g, '-') // Replace multiple hyphens with single
		.replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

	// Handle edge case where slug becomes empty after processing
	if (!slug) {
		return `${id}-untitled`;
	}

	return `${id}-${slug}`;
}

/**
 * Parses a slug path to extract the ID and slug components
 * @param path - The slug path to parse (format: "{id}-{slug}")
 * @returns Object with id and slug, or null if invalid format
 * @example parseSlugPath("42-italian-classics") => { id: 42, slug: "italian-classics" }
 */
export function parseSlugPath(path: string): { id: number; slug: string } | null {
	const match = path.match(/^(\d+)-(.+)$/);
	if (!match) return null;

	return {
		id: parseInt(match[1], 10),
		slug: match[2],
	};
}

/**
 * Generates a recipe URL with collection context
 * @param recipe - The recipe object with collection data (must include url_slug fields)
 * @returns A string in format "/recipes/{collection-slug}/{recipe-slug}"
 * @example generateRecipeUrl(recipe) => "/recipes/42-italian-classics/123-pasta-marinara"
 */
export function generateRecipeUrl(recipe: Recipe): string {
	const collectionSlug = recipe.collection_url_slug
		? generateSlugPath(recipe.collection_id, recipe.collection_url_slug)
		: generateSlugFromTitle(recipe.collection_id, recipe.collection_title);
	const recipeSlug = recipe.url_slug ? generateSlugPath(recipe.id, recipe.url_slug) : generateSlugFromTitle(recipe.id, recipe.name);
	return `/recipes/${collectionSlug}/${recipeSlug}`;
}

/**
 * Parses recipe URL parameters and validates format
 * @param collectionSlug - The collection slug from URL
 * @param recipeSlug - The recipe slug from URL
 * @returns Object with collection and recipe IDs, or null if invalid format
 * @example parseRecipeUrl("42-italian-classics", "123-pasta-marinara") => { collectionId: 42, recipeId: 123 }
 */
export function parseRecipeUrl(
	collectionSlug: string,
	recipeSlug: string
): {
	collectionId: number;
	recipeId: number;
} | null {
	const collection = parseSlugPath(collectionSlug);
	const recipe = parseSlugPath(recipeSlug);

	if (!collection || !recipe) return null;

	return {
		collectionId: collection.id,
		recipeId: recipe.id,
	};
}
