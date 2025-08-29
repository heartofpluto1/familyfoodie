/**
 * Database result type definitions for query functions
 * These interfaces represent the actual structure of data returned from database queries
 */

/**
 * Base access type for resources with household context
 */
export type AccessType = 'owned' | 'accessible' | 'subscribed' | 'public';

/**
 * Result from ingredient access queries (access-tiers.ts)
 * Based on SQL: SELECT DISTINCT i.*, CASE WHEN i.household_id = ? THEN 'owned' ELSE 'accessible' END as access_type, i.household_id = ? as can_edit
 */
export interface IngredientAccessResult {
	// Base ingredient fields
	id: number;
	name: string;
	fresh: number; // 0 or 1 (boolean in DB)
	supermarketCategory_id: number | null;
	cost: number | null;
	stockcode: string | null;
	public: number; // 0 or 1 (boolean in DB)
	pantryCategory_id: number | null;
	household_id: number;
	parent_id: number | null;

	// Query-added fields
	access_type: 'owned' | 'accessible';
	can_edit: number; // 0 or 1 (boolean in DB)
}

/**
 * Result from collection search queries (search.ts)
 * Based on SQL: SELECT c.*, h.name as owner_name, CASE ... END as access_type, COUNT(cr.recipe_id) as recipe_count, etc.
 */
export interface CollectionSearchResult {
	// Base collection fields
	id: number;
	title: string;
	subtitle: string | null;
	filename: string | null;
	filename_dark: string | null;
	household_id: number;
	parent_id: number | null;
	public: number; // 0 or 1 (boolean in DB)
	url_slug: string;
	created_at: Date;
	updated_at: Date;

	// Query-added fields
	owner_name: string; // From households table
	access_type: AccessType | null;
	recipe_count: number;
	can_edit: number; // 0 or 1 (boolean in DB)
	can_subscribe: number; // 0 or 1 (boolean in DB)
}

/**
 * Result from ingredient search queries (search.ts)
 * Based on SQL: SELECT DISTINCT i.*, CASE ... END as access_type, i.household_id = ? as can_edit, pc.name as pantryCategory_name, sc.name as supermarketCategory_name
 */
export interface IngredientSearchResult {
	// Base ingredient fields
	id: number;
	name: string;
	fresh: number; // 0 or 1 (boolean in DB)
	supermarketCategory_id: number | null;
	cost: number | null;
	stockcode: string | null;
	public: number; // 0 or 1 (boolean in DB)
	pantryCategory_id: number | null;
	household_id: number;
	parent_id: number | null;

	// Query-added fields
	access_type: 'owned' | 'accessible';
	can_edit: number; // 0 or 1 (boolean in DB)
	pantryCategory_name: string | null;
	supermarketCategory_name: string | null;
}

/**
 * Result from subscription check queries (subscriptions.ts)
 * Based on SQL: SELECT 1 FROM collection_subscriptions WHERE ...
 */
export interface SubscriptionCheckResult {
	'1': number; // SQL "SELECT 1" returns a field named '1'
}

/**
 * MySQL RowDataPacket with proper typing for subscription checks
 */
export type SubscriptionCheckRows = SubscriptionCheckResult[];

/**
 * Access validation result types for different resources
 * Used in access-tiers.ts validateAccessTier function
 */
export interface CollectionAccessResult {
	id: number;
	access_type: AccessType | null;
	can_subscribe?: number; // 0 or 1 (boolean in DB)
}

export interface RecipeAccessResult {
	id: number;
	access_type: AccessType | null;
}

export interface IngredientAccessResultForValidation {
	id: number;
	access_type: AccessType | null;
}
