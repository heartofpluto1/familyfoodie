import pool from './db.js';

/**
 * Three-Tier Access System Implementation
 * 
 * Tier 1 - Browsing: Public collections and recipes for discovery
 * Tier 2 - Planning: Owned + subscribed collections for meal planning
 * Tier 3 - Ingredients: Enhanced access including Spencer's essentials
 */

export interface AccessContext {
  tier: 'browsing' | 'planning' | 'ingredients';
  household_id: number;
  access_type: 'owned' | 'subscribed' | 'public';
  can_edit: boolean;
  can_subscribe: boolean;
}

/**
 * Tier 1 - Browsing Access
 * Public collections and recipes for discovery
 */
export async function getBrowsingAccessCollections(household_id: number): Promise<any[]> {
  const query = `
    SELECT c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, 
           c.created_at, c.updated_at, h.name as household_name,
           CASE WHEN cs.household_id IS NOT NULL THEN 'subscribed' ELSE 'public' END as access_type,
           COUNT(CASE WHEN r.archived = 0 THEN cr.recipe_id END) as recipe_count,
           false as can_edit,
           cs.household_id IS NULL as can_subscribe,
           c.household_id
    FROM collections c
    JOIN households h ON c.household_id = h.id
    LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
    LEFT JOIN recipes r ON cr.recipe_id = r.id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE c.public = 1
    GROUP BY c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, c.created_at, c.updated_at, h.name, c.household_id, cs.household_id
    ORDER BY c.title ASC
  `;
  
  const [rows] = await pool.execute(query, [household_id]);
  return rows as any[];
}

/**
 * Tier 2 - Planning Access
 * Owned + subscribed collections for meal planning
 */
export async function getPlanningAccessCollections(household_id: number): Promise<any[]> {
  const query = `
    SELECT c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, 
           c.created_at, c.updated_at, h.name as household_name,
           CASE WHEN c.household_id = ? THEN 'owned' ELSE 'subscribed' END as access_type,
           COUNT(CASE WHEN r.archived = 0 THEN cr.recipe_id END) as recipe_count,
           c.household_id = ? as can_edit,
           false as can_subscribe,
           c.household_id
    FROM collections c
    JOIN households h ON c.household_id = h.id
    LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
    LEFT JOIN recipes r ON cr.recipe_id = r.id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE c.household_id = ? OR cs.household_id IS NOT NULL
    GROUP BY c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, c.created_at, c.updated_at, h.name, c.household_id
    ORDER BY access_type ASC, c.title ASC
  `;
  
  const [rows] = await pool.execute(query, [household_id, household_id, household_id, household_id]);
  return rows as any[];
}

/**
 * Tier 3 - Ingredients Access
 * Enhanced access including Spencer's essentials + subscribed collections
 */
export async function getIngredientsAccessIngredients(household_id: number): Promise<any[]> {
  const query = `
    SELECT DISTINCT i.*,
           CASE WHEN i.household_id = ? THEN 'owned' ELSE 'accessible' END as access_type,
           i.household_id = ? as can_edit
    FROM ingredients i
    LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
    LEFT JOIN recipes r ON ri.recipe_id = r.id
    LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
    LEFT JOIN collections c ON cr.collection_id = c.id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE (
      i.household_id = ? OR  -- Household's own ingredients
      c.id = 1 OR           -- Always include Spencer's essentials (collection_id=1)
      cs.household_id IS NOT NULL  -- Ingredients from subscribed collections
    )
    AND NOT EXISTS (
      SELECT 1 FROM ingredients i2 
      WHERE i2.household_id = ? 
      AND i2.parent_id = i.id
      AND i.household_id != ?
    )
    ORDER BY access_type ASC, i.name ASC  -- Prioritize owned ingredients
  `;
  
  const [rows] = await pool.execute(query, [
    household_id, household_id, household_id, household_id, 
    household_id, household_id
  ]);
  return rows as any[];
}

/**
 * Validate access tier for a specific resource
 */
export async function validateAccessTier(
  household_id: number,
  resource_type: 'collection' | 'recipe' | 'ingredient',
  resource_id: number,
  required_tier: 'browsing' | 'planning' | 'ingredients'
): Promise<AccessContext | null> {
  let query: string;
  let params: any[];

  switch (resource_type) {
    case 'collection':
      query = `
        SELECT c.household_id,
               c.public,
               cs.household_id as is_subscribed,
               CASE 
                 WHEN c.household_id = ? THEN 'owned'
                 WHEN cs.household_id IS NOT NULL THEN 'subscribed' 
                 WHEN c.public = 1 THEN 'public'
                 ELSE NULL 
               END as access_type,
               c.household_id = ? as can_edit,
               (c.public = 1 AND c.household_id != ? AND cs.household_id IS NULL) as can_subscribe
        FROM collections c
        LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
        WHERE c.id = ?
      `;
      params = [household_id, household_id, household_id, household_id, resource_id];
      break;

    case 'recipe':
      query = `
        SELECT r.household_id as recipe_household_id,
               c.household_id as collection_household_id,
               c.public as collection_public,
               cs.household_id as is_subscribed_to_collection,
               CASE 
                 WHEN r.household_id = ? THEN 'owned'
                 WHEN c.household_id = ? OR cs.household_id IS NOT NULL THEN 'accessible'
                 WHEN c.public = 1 THEN 'public'
                 ELSE NULL 
               END as access_type,
               r.household_id = ? as can_edit
        FROM recipes r
        LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
        LEFT JOIN collections c ON cr.collection_id = c.id
        LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
        WHERE r.id = ?
        ORDER BY access_type ASC
        LIMIT 1
      `;
      params = [household_id, household_id, household_id, household_id, resource_id];
      break;

    case 'ingredient':
      query = `
        SELECT i.household_id as ingredient_household_id,
               r.household_id as recipe_household_id,
               c.household_id as collection_household_id,
               c.public as collection_public,
               cs.household_id as is_subscribed_to_collection,
               CASE 
                 WHEN i.household_id = ? THEN 'owned'
                 WHEN r.household_id = ? OR c.household_id = ? OR cs.household_id IS NOT NULL OR c.id = 1 THEN 'accessible'
                 WHEN c.public = 1 THEN 'public'
                 ELSE NULL 
               END as access_type,
               i.household_id = ? as can_edit
        FROM ingredients i
        LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
        LEFT JOIN recipes r ON ri.recipe_id = r.id
        LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
        LEFT JOIN collections c ON cr.collection_id = c.id
        LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
        WHERE i.id = ?
        ORDER BY access_type ASC
        LIMIT 1
      `;
      params = [household_id, household_id, household_id, household_id, household_id, resource_id];
      break;

    default:
      return null;
  }

  try {
    const [rows] = await pool.execute(query, params);
    const results = rows as any[];
    
    if (results.length === 0) return null;
    
    const result = results[0];
    if (!result.access_type) return null; // No access
    
    // Validate tier access
    const tierHierarchy = ['browsing', 'planning', 'ingredients'];
    const requiredTierIndex = tierHierarchy.indexOf(required_tier);
    const accessTierIndex = result.access_type === 'public' ? 0 : 
                           result.access_type === 'subscribed' ? 1 : 2;
    
    if (accessTierIndex < requiredTierIndex) return null;
    
    return {
      tier: required_tier,
      household_id,
      access_type: result.access_type,
      can_edit: !!result.can_edit,
      can_subscribe: result.can_subscribe !== undefined ? !!result.can_subscribe : false
    };
  } catch (error) {
    console.error(`Error validating access tier:`, error);
    return null;
  }
}

/**
 * Get access context for multiple resources at once
 */
export async function validateMultipleAccessTiers(
  household_id: number,
  resources: Array<{
    type: 'collection' | 'recipe' | 'ingredient';
    id: number;
    required_tier: 'browsing' | 'planning' | 'ingredients';
  }>
): Promise<Record<string, AccessContext | null>> {
  const results: Record<string, AccessContext | null> = {};
  
  for (const resource of resources) {
    const key = `${resource.type}_${resource.id}`;
    results[key] = await validateAccessTier(
      household_id,
      resource.type,
      resource.id,
      resource.required_tier
    );
  }
  
  return results;
}

/**
 * Check if user has required access level for a resource
 */
export function hasRequiredAccess(
  accessContext: AccessContext | null,
  requiredAccess: 'view' | 'edit' | 'subscribe'
): boolean {
  if (!accessContext) return false;
  
  switch (requiredAccess) {
    case 'view':
      return true; // If we have context, we have view access
    case 'edit':
      return accessContext.can_edit;
    case 'subscribe':
      return accessContext.can_subscribe;
    default:
      return false;
  }
}