# Agent 2: Authentication, Query & API Implementation

**Parent Spec:** [005-household-feature-spec.md](../specs/005-household-feature-spec.md)  
**Agent Role:** Authentication Foundation & API Development Specialist  
**Assigned Sections:** Authentication Layer (§0), Optimized Query Logic (§3), Application Layer Changes (§6)

## Git Workflow Requirements

### Branch Management
**BEFORE starting any work**, Agent 2 must create and checkout a dedicated branch:

```bash
# Create and checkout feature branch
git checkout -b feature/household-feature-integration-agent-2
git push -u origin feature/household-feature-integration-agent-2
```

### Commit Strategy
**AFTER each completed task**, Agent 2 must commit and push changes:

```bash
# Stage changes
git add .

# Commit with descriptive message referencing task
git commit -m "feat: [Task X.Y] Brief description of changes

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push origin feature/household-feature-integration-agent-2
```

**IMPORTANT**: After completing EVERY individual task (0.1, 0.2, 0.3, 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8), run the commit commands above with the appropriate task-specific message from the list below.

### Commit Message Format
- **Task 0.1**: `feat: [Task 0.1] Add SessionUser interface with household context`
- **Task 0.2**: `feat: [Task 0.2] Update withAuth middleware with household context`
- **Task 0.3**: `feat: [Task 0.3] Implement permission system foundation`
- **Task 1.1**: `feat: [Task 1.1] Implement collection query optimization with household scope`
- **Task 1.2**: `feat: [Task 1.2] Add recipe queries with household precedence`
- **Task 1.3**: `feat: [Task 1.3] Implement three-tier scoped resource access`
- **Task 1.4**: `feat: [Task 1.4] Add household-scoped shopping list generation`
- **Task 2.1**: `feat: [Task 2.1] Implement enhanced collection context-aware copy-on-write`
- **Task 2.2**: `feat: [Task 2.2] Add edit trigger integration with cascade copy`
- **Task 2.3**: `feat: [Task 2.3] Implement permission system validation`
- **Task 3.1**: `feat: [Task 3.1] Add collection subscription management APIs`
- **Task 3.2**: `feat: [Task 3.2] Implement three-tier access system`
- **Task 4.1**: `feat: [Task 4.1] Add advanced search with household precedence`
- **Task 4.2**: `feat: [Task 4.2] Implement SEO and URL system with household validation`
- **Task 5.1**: `feat: [Task 5.1] Update existing recipe endpoints with household logic`
- **Task 5.2**: `feat: [Task 5.2] Update existing ingredient endpoints with household logic`
- **Task 5.3**: `feat: [Task 5.3] Update existing collection endpoints with household logic`
- **Task 5.4**: `feat: [Task 5.4] Update existing plan endpoints with household logic`
- **Task 5.5**: `feat: [Task 5.5] Update existing shop endpoints with household logic`
- **Task 5.6**: `feat: [Task 5.6] Update missing recipe endpoints with household logic`
- **Task 5.7**: `feat: [Task 5.7] Create new collection-specific endpoints`
- **Task 6.1**: `refactor: [Task 6.1] Clean up authentication code and remove redundancy`
- **Task 6.2**: `refactor: [Task 6.2] Audit and clean up query functions`
- **Task 6.3**: `refactor: [Task 6.3] Clean up API endpoint patterns and response types`
- **Task 6.4**: `refactor: [Task 6.4] Clean up copy-on-write logic and remove debug code`
- **Task 6.5**: `refactor: [Task 6.5] Optimize database queries for performance`
- **Task 6.6**: `test: [Task 6.6] Run comprehensive verification (lint, test, build)`
- **Task 6.7**: `docs: [Task 6.7] Update documentation and code comments`
- **Task 6.8**: `test: [Task 6.8] Validate performance improvements achieved`

## Scope & Responsibilities

This agent is responsible for implementing the authentication foundation with household context, all household-aware query logic, API endpoints, and copy-on-write mechanisms that power the household feature functionality.

### Primary Deliverables

1. **Authentication Foundation**
   - SessionUser interface with household context
   - Session validation with household joins
   - API middleware providing household_id to all routes
   - Core permission system for resource access

2. **Optimized Query Implementation**
   - Junction table-based collection-recipe queries
   - Household precedence search algorithms
   - Scoped resource access queries (`getMyRecipes`, `getMyIngredients`)
   - Collection subscription management queries

3. **Copy-on-Write Logic**
   - Collection copying with junction table optimization
   - Recipe/ingredient cascade copying triggers
   - Edit permission validation
   - Automatic cleanup integration

4. **API Endpoints Development**
   - Household-scoped collection endpoints
   - Recipe search with precedence logic
   - Collection subscription management APIs
   - Copy-on-write trigger endpoints

5. **Performance Optimization**
   - Query optimization for household-scoped operations
   - Efficient junction table joins
   - Indexed search algorithms

## Detailed Task Breakdown

### Phase 0: Authentication Foundation (Days 1-2)

#### Task 0.1: Session Context Extension
Update core authentication to include household information:
```typescript
// src/lib/auth.ts
export interface SessionUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  household_id: number;  // NEW: household context
  household_name: string; // NEW: for UI display
}

// Update session validation to fetch household info
export async function validateSession(token: string): Promise<SessionUser | null> {
  // Join with households table to get household context
  const query = `
    SELECT u.*, h.name as household_name 
    FROM users u 
    JOIN households h ON u.household_id = h.id 
    WHERE u.id = ?
  `;
  // Implementation details...
}
```

#### Task 0.2: API Middleware Updates
Update `withAuth()` middleware to provide household context to API routes:
```typescript
// src/lib/middleware/withAuth.ts
export interface AuthenticatedRequest extends NextRequest {
  user: SessionUser;
  household_id: number; // NEW: direct access for API handlers
}

// All API routes now have household context available
export function withAuth<T>(
  handler: (request: AuthenticatedRequest, context: T) => Promise<Response>
) {
  return async (request: NextRequest, context: T) => {
    // Existing authentication logic...
    
    // NEW: Add household context to request
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = user;
    authenticatedRequest.household_id = user.household_id;
    
    return handler(authenticatedRequest, context);
  };
}
```

#### Task 0.3: Permission System Foundation
Implement core permission validation system:
```typescript
// src/lib/permissions.ts
export async function canEditResource(
  user_household_id: number,
  resource_type: 'collections' | 'recipes' | 'ingredients' | 'plans' | 'shopping_lists',
  resource_id: number
): Promise<boolean> {
  const query = `SELECT household_id FROM ${resource_type} WHERE id = ?`;
  const [rows] = await pool.execute(query, [resource_id]);
  
  if (rows.length === 0) return false;
  return rows[0].household_id === user_household_id;
}

export async function validateHouseholdAccess(
  user_household_id: number,
  collection_id: number
): Promise<'owned' | 'subscribed' | 'public' | null> {
  // Implementation for collection access validation
}
```

### Phase 1: Core Query Functions (Days 3-5)

#### Task 1.1: Collection Query Optimization
Implement separate functions for different collection views:
```typescript
// src/lib/queries/collections.ts
export async function getMyCollections(household_id: number) {
  const query = `
    SELECT c.*, h.name as owner_name,
           CASE WHEN c.household_id = ? THEN 'owned' ELSE 'subscribed' END as access_type,
           COUNT(cr.recipe_id) as recipe_count,
           c.household_id = ? as can_edit,
           false as can_subscribe
    FROM collections c
    JOIN households h ON c.household_id = h.id
    LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE c.household_id = ? OR cs.household_id IS NOT NULL
    GROUP BY c.id
    ORDER BY access_type, c.title
  `;
}

export async function getPublicCollections(household_id: number) {
  const query = `
    SELECT c.*, h.name as owner_name,
           CASE WHEN cs.household_id IS NOT NULL THEN 'subscribed' ELSE 'public' END as access_type,
           COUNT(cr.recipe_id) as recipe_count,
           false as can_edit,
           cs.household_id IS NULL as can_subscribe
    FROM collections c
    JOIN households h ON c.household_id = h.id
    LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE c.public = 1
    GROUP BY c.id
    ORDER BY c.title
  `;
}
```

#### Task 1.2: Recipe Query with Household Precedence
Implement `searchRecipesWithPrecedence()` and `getRecipesInCollection()`:
```typescript
// Show household's customized version preferentially
export async function getRecipesInCollection(collection_id: number, household_id: number) {
  // Enhanced junction table query with collection context and household precedence
  const query = `
    SELECT r.*, cr.added_at, cr.display_order,
           CASE WHEN r.household_id = ? THEN 'customized'
                WHEN r.household_id = c.household_id THEN 'original'
                ELSE 'referenced' END as status,
           c.household_id as collection_household_id,
           c.url_slug as current_collection_slug,
           ? as current_collection_id,
           (r.household_id = ?) as user_owns_recipe,
           (c.household_id = ?) as user_owns_collection
    FROM collection_recipes cr
    JOIN recipes r ON cr.recipe_id = r.id
    JOIN collections c ON cr.collection_id = c.id
    WHERE cr.collection_id = ?
    AND (
        r.household_id = ? 
        OR 
        (r.household_id != ?
         AND NOT EXISTS (
            SELECT 1 FROM recipes r2 
            WHERE r2.household_id = ? 
            AND r2.parent_id = r.id
        ))
    )
    ORDER BY cr.display_order, cr.added_at
  `;
  const [rows] = await pool.execute(query, [
    household_id, collection_id, household_id, household_id, collection_id, 
    household_id, household_id, household_id
  ]);
  
  // Transform rows to include access_context
  return rows.map(row => ({
    ...row,
    current_collection_id: row.current_collection_id,
    current_collection_slug: row.current_collection_slug,
    access_context: {
      collection_household_id: row.collection_household_id,
      recipe_household_id: row.household_id,
      user_owns_collection: !!row.user_owns_collection,
      user_owns_recipe: !!row.user_owns_recipe
    }
  }));
}
```

#### Task 1.3: Scoped Resource Access
Implement the three-tier access system with existing query compatibility:
```typescript
// src/lib/queries/menus.ts - Update existing file
export async function getMyRecipes(household_id: number): Promise<Recipe[]> {
  // Owned + subscribed for meal planning (remove duplicates - prioritise owned)
  const query = `
    SELECT DISTINCT r.*, 
           CASE WHEN r.household_id = ? THEN 'owned' ELSE 'subscribed' END as access_type,
           r.household_id = ? as can_edit
    FROM recipes r
    LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
    LEFT JOIN collections c ON cr.collection_id = c.id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE (
      r.household_id = ? OR  -- Owned recipes
      (c.household_id = ? OR cs.household_id IS NOT NULL) -- Recipes from owned/subscribed collections
    )
    AND NOT EXISTS (
      SELECT 1 FROM recipes r2 
      WHERE r2.household_id = ? 
      AND r2.parent_id = r.id
      AND r.household_id != ?  -- Only check for household copies when recipe is not already owned
    )
    ORDER BY access_type ASC, r.name ASC  -- Prioritize owned recipes
  `;
  
  const [rows] = await pool.execute(query, [
    household_id, household_id, household_id, household_id, household_id, 
    household_id, household_id
  ]);
  return rows as Recipe[];
}

export async function getAllRecipesWithDetails(household_id: number, collectionId?: number): Promise<Recipe[]> {
  // Enhanced for search with household precedence
  let query = `
    SELECT DISTINCT r.*,
           CASE WHEN r.household_id = ? THEN 'customized'
                WHEN EXISTS (SELECT 1 FROM collections c WHERE c.id = cr.collection_id AND c.household_id = r.household_id) THEN 'original'
                ELSE 'referenced' END as status,
           GROUP_CONCAT(DISTINCT c.title ORDER BY c.title SEPARATOR ', ') as collections,
           r.household_id = ? as can_edit
    FROM recipes r
    LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id  
    LEFT JOIN collections c ON cr.collection_id = c.id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE (
      r.household_id = ? OR  -- Household's own recipes
      c.public = 1 OR        -- Recipes in public collections  
      cs.household_id IS NOT NULL  -- Recipes in subscribed collections
    )
    AND NOT EXISTS (
      SELECT 1 FROM recipes r2 
      WHERE r2.household_id = ? 
      AND r2.parent_id = r.id
      AND r.household_id != ?
    )
  `;
  
  const params = [household_id, household_id, household_id, household_id, household_id, household_id];
  
  if (collectionId) {
    query += ` AND cr.collection_id = ?`;
    params.push(collectionId);
  }
  
  query += ` GROUP BY r.id ORDER BY status ASC, r.name ASC`;
  
  const [rows] = await pool.execute(query, params);
  return rows as Recipe[];
}

export async function getRecipeDetails(id: string, household_id: number): Promise<Recipe | null> {
  // Single recipe with household precedence
  const query = `
    SELECT r.*,
           CASE WHEN r.household_id = ? THEN 'owned' ELSE 'accessible' END as access_type,
           r.household_id = ? as can_edit,
           GROUP_CONCAT(DISTINCT c.title ORDER BY c.title SEPARATOR ', ') as collections
    FROM recipes r
    LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
    LEFT JOIN collections c ON cr.collection_id = c.id  
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE r.id = ?
    AND (
      r.household_id = ? OR  -- User owns recipe
      c.public = 1 OR        -- Recipe in public collection
      cs.household_id IS NOT NULL  -- Recipe in subscribed collection
    )
    GROUP BY r.id
  `;
  
  const [rows] = await pool.execute(query, [household_id, household_id, household_id, id, household_id]);
  const recipes = rows as Recipe[];
  return recipes.length > 0 ? recipes[0] : null;
}

export async function getMyIngredients(household_id: number): Promise<Ingredient[]> {
  // Enhanced discovery access - household + collection_id=1 (Spencer's essentials) + subscribed collections
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
  return rows as Ingredient[];
}

export async function getCollectionById(id: number, household_id: number): Promise<Collection | null> {
  // Single collection access with household validation
  const query = `
    SELECT c.*, h.name as owner_name,
           CASE 
             WHEN c.household_id = ? THEN 'owned'
             WHEN cs.household_id IS NOT NULL THEN 'subscribed' 
             WHEN c.public = 1 THEN 'public'
             ELSE NULL 
           END as access_type,
           COUNT(cr.recipe_id) as recipe_count,
           c.household_id = ? as can_edit,
           (c.public = 1 AND c.household_id != ? AND cs.household_id IS NULL) as can_subscribe
    FROM collections c
    JOIN households h ON c.household_id = h.id
    LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE c.id = ?
    AND (
      c.household_id = ? OR       -- User owns collection
      cs.household_id IS NOT NULL OR  -- User subscribed to collection
      c.public = 1               -- Public collection
    )
    GROUP BY c.id
  `;
  
  const [rows] = await pool.execute(query, [
    household_id, household_id, household_id, household_id, 
    id, household_id
  ]);
  const collections = rows as Collection[];
  return collections.length > 0 ? collections[0] : null;
}

// Keep existing functions signatures for reference
export async function getMyCollections(household_id: number) // Owned + subscribed only (remove duplicates - prioritise owned) - IMPLEMENTED ABOVE
export async function getPublicCollections(household_id: number) // Public browsing/discovery - IMPLEMENTED ABOVE
```

#### Task 1.4: Shopping List Query Integration
Implement household-scoped shopping list generation with existing complexity:
```typescript
// Complex shopping list generation maintaining existing logic
export async function resetShoppingListFromRecipes(week: number, year: number, household_id: number)
export async function getShoppingList(week: string, year: string, household_id: number)

// Ingredient aggregation logic with household scoping
- Maintain existing grouping by ingredient_id + quantityMeasure_id
- Preserve quantity aggregation for duplicate ingredients  
- Keep fresh/pantry categorization and sorting logic
- Maintain cost inheritance and stockcode preservation
```

### Phase 2: Copy-on-Write Implementation (Days 6-8)

#### Task 2.1: Enhanced Collection Context-Aware Copy-on-Write
Implement enhanced cascade copying that handles collection context chains:
```typescript
// Enhanced cascade copy with collection context awareness
export async function triggerCascadeCopyWithContext(
  user_household_id: number,
  collection_id: number,
  recipe_id: number
): Promise<{
  new_collection_id: number;
  new_recipe_id: number;
  new_collection_slug?: string;
  new_recipe_slug?: string;
  actions_taken: string[];
}> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Call enhanced cascade copy stored procedure
    const copyQuery = `
      CALL CascadeCopyWithContext(?, ?, ?, @new_collection_id, @new_recipe_id, @actions_taken)
    `;
    await connection.execute(copyQuery, [user_household_id, collection_id, recipe_id]);
    
    // Get results and slug information
    const [results] = await connection.execute(`
      SELECT @new_collection_id as new_collection_id, 
             @new_recipe_id as new_recipe_id,
             @actions_taken as actions_taken
    `);
    
    const result = results[0];
    const actions = result.actions_taken ? result.actions_taken.split(',').filter(Boolean) : [];
    
    // Note: actions_taken may include 'unsubscribed_from_original' when collection is copied
    
    // Get new slugs if resources were copied
    let new_collection_slug, new_recipe_slug;
    
    if (actions.includes('collection_copied')) {
      const [collectionRows] = await connection.execute(
        'SELECT url_slug FROM collections WHERE id = ?', 
        [result.new_collection_id]
      );
      new_collection_slug = collectionRows[0]?.url_slug;
    }
    
    if (actions.includes('recipe_copied')) {
      const [recipeRows] = await connection.execute(
        'SELECT url_slug FROM recipes WHERE id = ?', 
        [result.new_recipe_id]
      );
      new_recipe_slug = recipeRows[0]?.url_slug;
    }
    
    await connection.commit();
    
    return {
      new_collection_id: result.new_collection_id,
      new_recipe_id: result.new_recipe_id,
      new_collection_slug,
      new_recipe_slug,
      actions_taken: actions
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Original optimized collection copying (shallow copy with automatic unsubscribe)
export async function copyCollectionOptimized(source_id: number, target_household_id: number) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Copy collection record only
    const copyQuery = `
      INSERT INTO collections (title, subtitle, filename, filename_dark, household_id, parent_id, public)
      SELECT CONCAT(title, ' (Copy)'), subtitle, filename, filename_dark, ?, id, 0
      FROM collections WHERE id = ?
    `;
    const [result] = await connection.execute(copyQuery, [target_household_id, source_id]);
    const newCollectionId = result.insertId;
    
    // Copy junction records (12 bytes each vs 500+ bytes for recipe records)
    const junctionQuery = `
      INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
      SELECT ?, cr.recipe_id, NOW()
      FROM collection_recipes cr WHERE cr.collection_id = ?
    `;
    await connection.execute(junctionQuery, [newCollectionId, source_id]);
    
    // Unsubscribe from original collection since we now have our own copy
    const unsubscribeQuery = `
      DELETE FROM collection_subscriptions 
      WHERE household_id = ? AND collection_id = ?
    `;
    await connection.execute(unsubscribeQuery, [target_household_id, source_id]);
    
    await connection.commit();
    return newCollectionId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

#### Task 2.2: Edit Trigger Integration
Implement `triggerCascadeCopyIfNeeded()` to seamlessly integrate stored procedures:
```typescript
export async function triggerCascadeCopyIfNeeded(
  user_household_id: number,
  recipe_id: number
): Promise<number> {
  const canEdit = await canEditResource(user_household_id, 'recipe', recipe_id);
  
  if (canEdit) {
    return recipe_id; // No copy needed
  }
  
  // Trigger cascade copy using stored procedure from Agent 1
  const copyQuery = `CALL CopyRecipeForEdit(?, ?, @new_recipe_id)`;
  await pool.execute(copyQuery, [recipe_id, user_household_id]);
  
  const [result] = await pool.execute('SELECT @new_recipe_id as new_id');
  return result[0].new_id;
}
```

#### Task 2.3: Permission System
Implement `canEditResource()` with household ownership validation:
```typescript
export async function canEditResource(
  user_household_id: number,
  // Every resource now has NOT NULL household_id
  resource_type: 'collections' | 'recipes' | 'ingredients' | 'plans' | 'shopping_lists',
  resource_id: number
): Promise<boolean> {  
  const query = `SELECT household_id FROM ${resource_type} WHERE id = ?`;
  // Return resource_household_id === user_household_id
}
```

### Phase 3: Subscription Management (Days 9-10)

#### Task 3.1: Collection Subscription APIs
Implement complete subscription management system:
```typescript
// src/lib/queries/subscriptions.ts - NEW FILE
import pool from '@/lib/db.js';

export async function subscribeToCollection(household_id: number, collection_id: number): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Check if collection exists and is public
    const checkQuery = `
      SELECT c.id, c.public, c.household_id
      FROM collections c 
      WHERE c.id = ?
    `;
    const [checkRows] = await connection.execute(checkQuery, [collection_id]);
    
    if (checkRows.length === 0) {
      throw new Error('Collection not found');
    }
    
    const collection = checkRows[0];
    
    // Cannot subscribe to own collections
    if (collection.household_id === household_id) {
      throw new Error('Cannot subscribe to your own collection');
    }
    
    // Can only subscribe to public collections
    if (!collection.public) {
      throw new Error('Cannot subscribe to private collection');
    }
    
    // Check if already subscribed
    const existsQuery = `
      SELECT 1 FROM collection_subscriptions 
      WHERE household_id = ? AND collection_id = ?
    `;
    const [existsRows] = await connection.execute(existsQuery, [household_id, collection_id]);
    
    if (existsRows.length > 0) {
      await connection.rollback();
      return false; // Already subscribed
    }
    
    // Insert subscription
    const insertQuery = `
      INSERT INTO collection_subscriptions (household_id, collection_id, subscribed_at)
      VALUES (?, ?, NOW())
    `;
    await connection.execute(insertQuery, [household_id, collection_id]);
    
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function unsubscribeFromCollection(household_id: number, collection_id: number): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Delete subscription
    const deleteQuery = `
      DELETE FROM collection_subscriptions 
      WHERE household_id = ? AND collection_id = ?
    `;
    const [result] = await connection.execute(deleteQuery, [household_id, collection_id]);
    
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getSubscribedCollections(household_id: number): Promise<Collection[]> {
  const query = `
    SELECT c.*, h.name as owner_name,
           'subscribed' as access_type,
           COUNT(cr.recipe_id) as recipe_count,
           false as can_edit,
           true as can_subscribe,
           cs.subscribed_at
    FROM collections c
    JOIN households h ON c.household_id = h.id
    JOIN collection_subscriptions cs ON c.id = cs.collection_id
    LEFT JOIN collection_recipes cr ON c.id = cr.collection_id
    WHERE cs.household_id = ?
    GROUP BY c.id
    ORDER BY cs.subscribed_at DESC, c.title ASC
  `;
  
  const [rows] = await pool.execute(query, [household_id]);
  return rows as Collection[];
}

export async function isSubscribed(household_id: number, collection_id: number): Promise<boolean> {
  const query = `
    SELECT 1 FROM collection_subscriptions 
    WHERE household_id = ? AND collection_id = ?
  `;
  
  const [rows] = await pool.execute(query, [household_id, collection_id]);
  return rows.length > 0;
}
```

#### Task 3.2: Three-Tier Access Implementation
- **My Collections Access**: Only owned + subscribed collections (editable, not subscribable)
- **Public Collections Access**: All public collections for browsing/discovery (not editable, subscribable)
- **Planning Access**: Only subscribed + owned collections for meal planning  
- **Ingredient Discovery**: Subscribed + owned + collection_id=1 always, no duplicates

### Phase 4: Search & URL System Implementation (Days 11-12)

#### Task 4.1: Advanced Search Implementation
Implement household-scoped search maintaining existing capabilities:
```typescript
// src/lib/queries/search.ts - NEW FILE
import pool from '@/lib/db.js';

export async function searchRecipesWithPrecedence(
  searchTerm: string,
  household_id: number,
  collectionId?: number
): Promise<Recipe[]> {
  // Multi-field search with household + subscribed precedence
  let query = `
    SELECT DISTINCT r.*, 
           CASE WHEN r.household_id = ? THEN 'customized'
                WHEN EXISTS (SELECT 1 FROM collections c WHERE c.id = cr.collection_id AND c.household_id = r.household_id) THEN 'original'
                ELSE 'referenced' END as status,
           GROUP_CONCAT(DISTINCT c.title ORDER BY c.title SEPARATOR ', ') as collections,
           r.household_id = ? as can_edit,
           s.name as seasonName
    FROM recipes r
    LEFT JOIN collection_recipes cr ON r.id = cr.recipe_id
    LEFT JOIN collections c ON cr.collection_id = c.id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    LEFT JOIN seasons s ON r.season_id = s.id
    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    LEFT JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE (
      r.household_id = ? OR  -- Household's own recipes
      c.public = 1 OR        -- Recipes in public collections  
      cs.household_id IS NOT NULL  -- Recipes in subscribed collections
    )
    AND NOT EXISTS (
      SELECT 1 FROM recipes r2 
      WHERE r2.household_id = ? 
      AND r2.parent_id = r.id
      AND r.household_id != ?
    )
    AND (
      LOWER(r.name) LIKE LOWER(?) OR
      LOWER(r.description) LIKE LOWER(?) OR
      LOWER(s.name) LIKE LOWER(?) OR
      LOWER(i.name) LIKE LOWER(?)
    )
  `;
  
  const searchPattern = `%${searchTerm}%`;
  const params = [
    household_id, household_id, household_id, household_id, 
    household_id, household_id, 
    searchPattern, searchPattern, searchPattern, searchPattern
  ];
  
  if (collectionId) {
    query += ` AND cr.collection_id = ?`;
    params.push(collectionId);
  }
  
  query += ` GROUP BY r.id ORDER BY status ASC, r.name ASC`;
  
  const [rows] = await pool.execute(query, params);
  return rows as Recipe[];
}

// Client-side filtering helper for performance (pre-loaded household data)
export function filterRecipesClientSide(recipes: Recipe[], searchTerm: string): Recipe[] {
  const search = searchTerm.toLowerCase();
  return recipes.filter(recipe => 
    recipe.name.toLowerCase().includes(search) ||
    recipe.description?.toLowerCase().includes(search) ||
    recipe.seasonName?.toLowerCase().includes(search) ||
    recipe.ingredients?.some(ingredient => ingredient.toLowerCase().includes(search))
  );
}
```

#### Task 4.2: SEO & URL System Integration  
Implement household-aware URL validation and routing:
```typescript
// src/lib/queries/validation.ts - NEW FILE
import pool from '@/lib/db.js';

export async function validateCollectionAccess(
  collectionId: number, 
  household_id: number
): Promise<'owned' | 'subscribed' | 'public' | null> {
  const query = `
    SELECT c.household_id, c.public,
           cs.household_id as is_subscribed
    FROM collections c
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE c.id = ?
  `;
  
  const [rows] = await pool.execute(query, [household_id, collectionId]);
  
  if (rows.length === 0) {
    return null; // Collection not found
  }
  
  const collection = rows[0];
  
  if (collection.household_id === household_id) {
    return 'owned';
  } else if (collection.is_subscribed) {
    return 'subscribed';
  } else if (collection.public) {
    return 'public';
  } else {
    return null; // No access
  }
}

export async function validateRecipeAccess(
  recipeId: number,
  collectionId: number, 
  household_id: number
): Promise<boolean> {
  const query = `
    SELECT r.household_id as recipe_household_id,
           c.household_id as collection_household_id,
           c.public as collection_public,
           cs.household_id as is_subscribed_to_collection
    FROM recipes r
    JOIN collection_recipes cr ON r.id = cr.recipe_id
    JOIN collections c ON cr.collection_id = c.id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE r.id = ? AND c.id = ?
  `;
  
  const [rows] = await pool.execute(query, [household_id, recipeId, collectionId]);
  
  if (rows.length === 0) {
    return false; // Recipe not found in collection
  }
  
  const access = rows[0];
  
  // User can access recipe if:
  // 1. They own the recipe
  // 2. They own the collection containing the recipe
  // 3. They're subscribed to the collection containing the recipe  
  // 4. The collection containing the recipe is public
  return (
    access.recipe_household_id === household_id ||
    access.collection_household_id === household_id ||
    access.is_subscribed_to_collection ||
    access.collection_public
  );
}

// Helper function for URL slug validation with household context
export async function validateSlugAccess(
  collectionSlug: string,
  recipeSlug: string,
  household_id: number
): Promise<{ collection_id: number; recipe_id: number } | null> {
  const query = `
    SELECT c.id as collection_id, r.id as recipe_id
    FROM collections c
    JOIN collection_recipes cr ON c.id = cr.collection_id
    JOIN recipes r ON cr.recipe_id = r.id
    LEFT JOIN collection_subscriptions cs ON c.id = cs.collection_id AND cs.household_id = ?
    WHERE c.url_slug = ? AND r.url_slug = ?
    AND (
      c.household_id = ? OR          -- User owns collection
      r.household_id = ? OR          -- User owns recipe
      cs.household_id IS NOT NULL OR -- User subscribed to collection
      c.public = 1                   -- Collection is public
    )
  `;
  
  const [rows] = await pool.execute(query, [
    household_id, collectionSlug, recipeSlug, 
    household_id, household_id
  ]);
  
  return rows.length > 0 ? rows[0] : null;
}

// SEO redirects with household-aware URL generation
// Note: Maintain existing parseSlugPath(), parseRecipeUrl(), generateSlugFromTitle()
// These functions add household context to URL validation flows
```

### Phase 5: API Endpoint Development (Days 13-15)

#### Task 5.1: Update Existing Recipe Endpoints
```typescript
// Update existing recipe endpoints with household logic

// src/app/api/recipe/delete/route.ts
- Add canEditResource() permission check before deletion
- Ensure only household-owned recipes can be deleted

// src/app/api/recipe/update-details/route.ts  
- Add triggerCascadeCopyIfNeeded() AFTER receiving form submission but before updating details
- Handle copy-on-write for non-owned recipes only when user submits changes

// NEW: Collection context-aware recipe editing endpoint
// src/app/api/recipes/[recipe_slug]/edit/route.ts
- Add triggerCascadeCopyWithContext() for collection+recipe cascade copying
- Handle collection context from request body (collection_id)
- Return new URLs after copy-on-write operations
- Support actions_taken response for UI feedback

// src/app/api/recipe/update-ingredients/route.ts
- Add triggerCascadeCopyIfNeeded() AFTER receiving form submission but before updating ingredients
- Handle ingredient copy-on-write only when user submits ingredient changes

// src/app/api/recipe/update-image/route.ts
- Add triggerCascadeCopyIfNeeded() AFTER receiving image upload but before updating image
- Handle copy-on-write only when user submits image changes

// src/app/api/recipe/update-pdf/route.ts
- Add triggerCascadeCopyIfNeeded() AFTER receiving PDF upload but before updating PDF
- Handle copy-on-write only when user submits PDF changes

// src/app/api/recipe/upload-image/route.ts
- Add household_id to new recipes created via image upload
- Ensure recipes are owned by user's household

// src/app/api/recipe/upload-pdf/route.ts
- Add household_id to new recipes created via PDF upload
- Ensure recipes are owned by user's household
```

#### Task 5.2: Update Existing Ingredient Endpoints
```typescript
// Update existing ingredient endpoints with household logic

// src/app/api/ingredients/add/route.ts
- Add household_id to new ingredients
- Ensure ingredients are owned by user's household

// src/app/api/ingredients/delete/route.ts
- Add canEditResource() permission check before deletion
- Ensure only household-owned ingredients can be deleted
- Add cleanup of orphaned ingredients

// src/app/api/ingredients/update/route.ts
- Add triggerCascadeCopyIfNeeded() AFTER receiving form submission but before updating ingredients
- Handle copy-on-write only when user submits ingredient changes
```

#### Task 5.3: Update Existing Collection Endpoints
```typescript
// Update existing collection endpoints with household logic

// src/app/api/collections/create/route.ts
- Add household_id to new collections
- Ensure collections are owned by user's household

// src/app/api/collections/delete/route.ts
- Add canEditResource() permission check before deletion
- Ensure only household-owned collections can be deleted
```

#### Task 5.4: Update Existing Plan Endpoints
```typescript
// Update existing plan endpoints with household logic

// src/app/api/plan/current/route.ts
- Add household_id filtering to current plan queries
- Ensure only household's plans are retrieved

// src/app/api/plan/delete/route.ts
- Add canEditResource() permission check before deletion
- Ensure only household-owned plans can be deleted

// src/app/api/plan/randomize/route.ts
- Add household_id filtering for getMyRecipes() access
- Use subscription-based recipe access for meal planning

// src/app/api/plan/save/route.ts
- Add household_id to new plans
- Ensure plans are owned by user's household

// src/app/api/plan/week/route.ts
- Add household_id filtering to week plan queries
- Ensure only household's plans are retrieved
```

#### Task 5.5: Update Existing Shop Endpoints
```typescript
// Update existing shop endpoints with household logic

// src/app/api/shop/route.ts
- Add household_id filtering to shopping list queries
- Ensure only household's shopping lists are retrieved

// src/app/api/shop/add/route.ts
- Add household_id to new shopping list items
- Ensure items are owned by user's household

// src/app/api/shop/move/route.ts
- Add canEditResource() permission check before moving items
- Ensure only household-owned items can be moved

// src/app/api/shop/purchase/route.ts
- Add canEditResource() permission check before marking purchased
- Ensure only household-owned items can be updated

// src/app/api/shop/remove/route.ts
- Add canEditResource() permission check before removal
- Ensure only household-owned items can be deleted

// src/app/api/shop/reset/route.ts
- Add household_id filtering for reset operations
- Ensure only household's shopping lists are reset
```

#### Task 5.6: Update Missing Recipe Endpoints  
```typescript
// Update additional existing recipe endpoints with household logic

// src/app/api/recipe/options/route.ts
- Add household_id filtering for getMyRecipes() access
- Use owned + subscribed collections > recipes access for meal planning selection (remove duplicates - prioritise owned)
- Maintain existing recipe selection interface for meal planning

// src/app/api/recipe/ingredients/route.ts  
- Add household precedence logic for recipe ingredient display
- Handle copy-on-write context for ingredient editing
- Scope ingredient access to household-accessible recipes

// src/app/api/recipe/ai-import/route.ts
- Add household_id to new recipes created via AI import
- Ensure AI-imported recipes are owned by user's household
- Integrate with existing PDF processing and AI extraction
```

#### Task 5.7: Create New Collection-Specific Endpoints
```typescript
// Create new endpoints for collection-specific functionality

// src/app/api/collections/[id]/copy/route.ts
POST - copyCollectionOptimized() with junction table approach
- Implement optimized collection copying with 14x storage savings
- Handle transaction rollback on failure
- Automatically unsubscribe user from original collection after copying

// src/app/api/collections/[id]/subscribe/route.ts
POST - subscribeToCollection() for subscription management
DELETE - unsubscribeFromCollection() for unsubscribing
- Validate subscription permissions and state changes
```

### Phase 6: Code Cleanup & Verification (Day 16)

After implementing all authentication, queries, copy-on-write logic, subscriptions, and API endpoints, perform comprehensive cleanup and verification to ensure code quality.

#### Task 6.1: Authentication Code Cleanup
Remove any redundant authentication utilities and clean up unused imports:

```typescript
// FILES TO AUDIT AND CLEAN:

// 1. Remove old authentication functions that don't handle households
// - Any authentication utilities that don't include household context
// - Legacy session management functions without household joins
// - Old permission checking functions without household_id parameter

// 2. Consolidate authentication middleware
// - Ensure consistent withAuth() implementation across all API routes
// - Remove any duplicate authentication logic
// - Clean up type definitions for AuthenticatedRequest
```

#### Task 6.2: Query Function Cleanup
Audit and remove redundant or unused query functions:

```typescript
// SEARCH AND CLEAN:

// 1. Remove old query functions that were replaced with household-aware versions
// - Any getAllRecipes() without household_id parameter
// - Old collection queries without subscription logic
// - Legacy ingredient queries without household precedence

// 2. Consolidate duplicate query logic
// - Remove any duplicate SQL queries with slight variations
// - Ensure consistent parameter ordering across similar queries
// - Clean up unused imports in query files
```

#### Task 6.3: API Endpoint Cleanup
Remove redundant API response types and clean up endpoint handlers:

```typescript
// CONSOLIDATE API PATTERNS:

// 1. Remove old API handler patterns that don't use household context
// - Any API routes without withAuth() middleware
// - Legacy response patterns without household validation
// - Unused error handling utilities

// 2. Clean up response type definitions
// - Remove duplicate API response interfaces
// - Consolidate similar response patterns
// - Ensure consistent error response formats
```

#### Task 6.4: Copy-on-Write Logic Cleanup
Clean up any temporary or redundant copy-on-write utilities:

```typescript
// AUDIT COPY-ON-WRITE CODE:

// 1. Remove any temporary copy-on-write functions used during development
// 2. Clean up unused imports related to copying logic
// 3. Ensure consistent error handling across all copy operations
// 4. Remove any debug logging or temporary validation code
```

#### Task 6.5: Database Query Optimization
Review and optimize database queries for performance:

```typescript
// OPTIMIZE QUERIES:

// 1. Review all complex queries for optimization opportunities
// 2. Ensure proper indexing hints are used where beneficial
// 3. Remove any unused query parameters or redundant WHERE clauses
// 4. Consolidate similar queries that could be combined
```

#### Task 6.6: Test Code Verification
Run comprehensive verification to ensure all changes work correctly:

```bash
# RUN THESE COMMANDS to verify Agent 2 implementation:

# 1. TypeScript compilation check
npx tsc --noEmit

# 2. ESLint check for code quality and unused imports
npm run lint

# 3. Run all tests to ensure functionality works
npm run test

# 4. Build check to ensure production readiness
npm run build

# 5. Test specific household features (if applicable)
npm run test -- --testPathPattern="household|auth|permission"
```

#### Task 6.7: Documentation and Code Comments
Update code documentation to reflect household-aware implementation:

```typescript
// UPDATE DOCUMENTATION:

// 1. JSDoc comments for all new household-aware functions
// 2. Update API endpoint documentation with household context requirements
// 3. Code comments explaining complex precedence logic
// 4. Update any README sections related to authentication or queries
// 5. Ensure copy-on-write logic is well documented for future maintenance
```

#### Task 6.8: Performance Validation
Validate that performance improvements were achieved:

```typescript
// VALIDATE PERFORMANCE GAINS:

// 1. Confirm junction table queries are faster than old approach
// 2. Verify copy-on-write operations complete within 500ms target
// 3. Test search queries with household precedence meet 100ms target
// 4. Ensure subscription queries are optimized with proper indexing
// 5. Document any performance bottlenecks discovered during testing
```

## Dependencies

### Upstream Dependencies (Must Complete First)
- **Agent 1**: Completed database schema and stored procedures
- **Agent 1**: Migration completed with Spencer household and data

### Downstream Dependencies (Other Agents Depend On)
- **Agent 3**: Completed API endpoints for frontend integration
- **Agent 3**: Working subscription management for UI components

## Success Criteria

### Git Workflow Requirements
- [ ] Feature branch `feature/household-feature-integration-agent-2` created and checked out before starting
- [ ] Each task committed individually with descriptive commit messages
- [ ] All commits pushed to remote branch after completion
- [ ] Commit messages follow specified format with task numbers
- [ ] Claude Code attribution included in all commit messages

### Authentication Requirements
- [ ] SessionUser interface includes household_id and household_name
- [ ] Session validation joins households table correctly
- [ ] withAuth() middleware provides household context to all API routes
- [ ] Permission system validates household ownership for all resources

### Functional Requirements
- [ ] Junction table queries working correctly with 14x storage savings
- [ ] Household precedence working in all search scenarios
- [ ] Copy-on-write triggering correctly on edit operations
- [ ] Three-tier access system properly scoped (browsing/planning/ingredients)
- [ ] Collection subscription management fully functional

### Performance Requirements
- [ ] 5-10x query performance improvement over old approach achieved
- [ ] Copy-on-write operations complete within 500ms for typical collections
- [ ] Search queries with household precedence under 100ms
- [ ] Subscription queries optimized with proper indexing

### API Requirements
- [ ] All household-scoped endpoints properly secured
- [ ] Copy-on-write logic seamlessly integrated into edit flows
- [ ] Subscription management APIs working with proper validation
- [ ] Error handling for permission denied scenarios

### Code Cleanup & Verification Requirements
- [ ] All redundant authentication utilities removed
- [ ] Old query functions without household context cleaned up
- [ ] Duplicate API response types consolidated
- [ ] Copy-on-write debug code and temporary functions removed
- [ ] Database queries optimized for performance
- [ ] TypeScript compilation passes without errors (`npx tsc --noEmit`)
- [ ] ESLint passes with no unused import warnings (`npm run lint`)
- [ ] All tests pass including household-specific features (`npm run test`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Performance targets achieved (500ms copy-on-write, 100ms search queries)
- [ ] Code documentation updated with household-aware implementation details

## Risk Mitigation

### High Risk: Complex Precedence Logic Bugs
- **Mitigation**: Comprehensive unit tests for all precedence scenarios
- **Rollback**: Fallback to global queries with household filtering

### Medium Risk: Performance Degradation in Large Datasets
- **Mitigation**: Benchmark with production-scale test data
- **Rollback**: Query optimization patches, additional indexing

### Medium Risk: Copy-on-Write Logic Bugs
- **Mitigation**: Transaction-based operations, extensive testing
- **Rollback**: Manual copy procedures as fallback

## Testing Strategy

### Required Test Files (*.test.ts)

#### Phase 0: Authentication Foundation Tests (Co-located with source files)
```typescript
// src/lib/auth.test.ts
- Test validateSession() with household context
- Test session management with household joins
- Test SessionUser interface validation

// src/lib/middleware/withAuth.test.ts
- Test middleware provides household_id to API routes
- Test AuthenticatedRequest interface functionality
- Test authentication failures and edge cases

// src/lib/permissions.test.ts
- Test canEditResource() for all resource types
- Test household isolation enforcement
- Test validateHouseholdAccess() logic
- Test permission denied scenarios
```

#### Phase 1: Query Function Tests (Co-located with source files)
```typescript
// src/lib/queries/collections.test.ts
- Test getMyCollections() with various household scenarios
- Test getPublicCollections() with subscription states
- Test copyCollectionOptimized() transaction handling with automatic unsubscribe
- Test junction table query performance vs old approach
- Test automatic unsubscription from original collection after copying

// src/lib/queries/recipes.test.ts  
- Test getRecipesInCollection() with household precedence
- Test searchRecipesWithPrecedence() ranking logic
- Test getMyRecipes() subscription-based filtering
- Test triggerCascadeCopyIfNeeded() copy-on-write logic

// src/lib/queries/ingredients.test.ts
- Test getMyIngredients() enhanced discovery access
- Test ingredient copy-on-write triggering
- Test cleanup of orphaned ingredients

// src/lib/queries/subscriptions.test.ts
- Test subscribeToCollection() validation and edge cases
- Test unsubscribeFromCollection() cleanup
- Test isSubscribed() accuracy across scenarios
- Test getSubscribedCollections() with various states
```

#### Phase 2: Copy-on-Write & Subscription Tests (Co-located with source files)
```typescript
// src/lib/queries/subscriptions.test.ts
- Test subscribeToCollection() validation and edge cases
- Test unsubscribeFromCollection() cleanup
- Test isSubscribed() accuracy across scenarios
- Test getSubscribedCollections() with various states
- Test copy-on-write permission triggers
```

#### Phase 3: API Endpoint Tests (Co-located with route files)
```typescript
// Update existing recipe endpoint tests
// src/app/api/recipe/delete/route.test.ts
- Test canEditResource() permission check prevents unauthorized deletion
- Test only household-owned recipes can be deleted

// src/app/api/recipe/update-details/route.test.ts
- Test triggerCascadeCopyIfNeeded() triggered only on form submission
- Test copy-on-write NOT triggered when just loading edit form

// src/app/api/recipe/update-ingredients/route.test.ts
- Test triggerCascadeCopyIfNeeded() triggered only on ingredient form submission
- Test ingredient copy-on-write integration on save

// src/app/api/recipe/update-image/route.test.ts
- Test triggerCascadeCopyIfNeeded() triggered only on image upload submission
- Test copy-on-write for image updates on save

// src/app/api/recipe/update-pdf/route.test.ts
- Test triggerCascadeCopyIfNeeded() triggered only on PDF upload submission
- Test copy-on-write for PDF updates on save

// src/app/api/recipe/upload-image/route.test.ts
- Test household_id added to new recipes from image upload
- Test recipes owned by user's household

// src/app/api/recipe/upload-pdf/route.test.ts
- Test household_id added to new recipes from PDF upload
- Test recipes owned by user's household

// Update existing ingredient endpoint tests
// src/app/api/ingredients/add/route.test.ts
- Test household_id added to new ingredients
- Test ingredients owned by user's household

// src/app/api/ingredients/delete/route.test.ts
- Test canEditResource() permission check prevents unauthorized deletion
- Test cleanup of orphaned ingredients

// src/app/api/ingredients/update/route.test.ts
- Test triggerCascadeCopyIfNeeded() triggered only on ingredient form submission
- Test copy-on-write for non-owned ingredients on save

// Update existing collection endpoint tests
// src/app/api/collections/create/route.test.ts
- Test household_id added to new collections
- Test collections owned by user's household

// src/app/api/collections/delete/route.test.ts
- Test canEditResource() permission check prevents unauthorized deletion
- Test only household-owned collections can be deleted

// New collection-specific endpoint tests
// src/app/api/collections/[id]/copy/route.test.ts
- Test POST /api/collections/[id]/copy optimized junction approach
- Test transaction rollback on copy failure
- Test 14x storage savings achieved vs old approach

// src/app/api/collections/[id]/subscribe/route.test.ts
- Test POST /api/collections/[id]/subscribe validation
- Test DELETE /api/collections/[id]/subscribe cleanup
- Test subscription state changes reflected in queries

// Update existing plan endpoint tests
// src/app/api/plan/current/route.test.ts
- Test household_id filtering in current plan queries
- Test only household's plans are retrieved

// src/app/api/plan/delete/route.test.ts
- Test canEditResource() permission check prevents unauthorized deletion
- Test only household-owned plans can be deleted

// src/app/api/plan/randomize/route.test.ts
- Test household_id filtering for getMyRecipes() access
- Test subscription-based recipe access for meal planning

// src/app/api/plan/save/route.test.ts
- Test household_id added to new plans
- Test plans owned by user's household

// src/app/api/plan/week/route.test.ts
- Test household_id filtering in week plan queries
- Test only household's plans are retrieved

// Update existing shop endpoint tests
// src/app/api/shop/route.test.ts
- Test household_id filtering in shopping list queries
- Test only household's shopping lists are retrieved

// src/app/api/shop/add/route.test.ts
- Test household_id added to new shopping list items
- Test items owned by user's household

// src/app/api/shop/move/route.test.ts
- Test canEditResource() permission check before moving items
- Test only household-owned items can be moved

// src/app/api/shop/purchase/route.test.ts
- Test canEditResource() permission check before marking purchased
- Test only household-owned items can be updated

// src/app/api/shop/remove/route.test.ts
- Test canEditResource() permission check before removal
- Test only household-owned items can be deleted

// src/app/api/shop/reset/route.test.ts
- Test household_id filtering for reset operations
- Test only household's shopping lists are reset

// Update missing recipe endpoint tests
// src/app/api/recipe/options/route.test.ts
- Test household_id filtering for getMyRecipes() access
- Test subscription-based recipe access for meal planning
- Test meal planning recipe selection interface

// src/app/api/recipe/ingredients/route.test.ts
- Test household precedence logic for recipe ingredient display
- Test copy-on-write context for ingredient editing
- Test scoped ingredient access to household-accessible recipes

// src/app/api/recipe/ai-import/route.test.ts
- Test household_id added to AI-imported recipes
- Test recipes owned by user's household
- Test existing PDF processing and AI extraction integration
```

#### Phase 4: Integration & Performance Tests (Dedicated test directories)
```typescript
// src/tests/integration/household-flows.test.ts
- Test complete copy-on-write flows end-to-end
- Test subscription → planning → editing workflows
- Test collection copying → recipe editing → ingredient discovery

// src/tests/performance/query-benchmarks.test.ts
- Benchmark junction table queries vs old collection_id approach
- Test 5-10x performance improvement achieved
- Test query performance with large datasets (1000+ collections/recipes)

// src/tests/security/household-isolation.test.ts
- Test strict household data isolation
- Test permission boundaries cannot be bypassed
- Test subscription-based access enforcement
```

### Test Coverage Requirements

#### Functional Test Coverage
- [ ] All query functions tested with multiple household scenarios
- [ ] All API endpoints tested with permission validation
- [ ] Copy-on-write logic tested with transaction rollback scenarios
- [ ] Subscription management tested with all state transitions
- [ ] Permission system tested with boundary conditions

#### Security Test Coverage  
- [ ] Household isolation verified - no cross-household data leakage
- [ ] Permission enforcement tested - no unauthorized edit/delete operations
- [ ] Subscription validation tested - no access to unsubscribed content
- [ ] Copy-on-write security tested - no unauthorized copying

#### Performance Test Coverage
- [ ] Copy-on-write operations tested under 500ms for typical collections
- [ ] Search queries with household precedence tested under 100ms

#### Edge Case Test Coverage
- [ ] Empty household scenarios (no owned/subscribed collections)
- [ ] Large dataset scenarios (1000+ collections, 10000+ recipes)
- [ ] Concurrent operation scenarios (multiple users copying simultaneously)
- [ ] Subscription state change scenarios (subscribe during copy operation)
- [ ] Parent-child relationship scenarios (editing with complex lineage)

### Test Data Setup

#### Required Test Fixtures
```typescript
// Test database with multiple households
const testHouseholds = ['Spencer', 'Johnson', 'Williams'];

// Test collections with various ownership and subscription states  
const testCollections = [
  { id: 1, household: 'Spencer', public: true },  // Spencer's essentials
  { id: 2, household: 'Spencer', public: true },  // Spencer's Italian
  { id: 3, household: 'Spencer', public: false }, // Spencer's private
  { id: 4, household: 'Johnson', public: false }, // Johnson's private
];

// Test subscription states
const testSubscriptions = [
  { household: 'Johnson', collection: 1 }, // Subscribed to Spencer's essentials
  { household: 'Williams', collection: 1 }, // Subscribed to Spencer's essentials
];

// Test recipes with parent-child relationships
const testRecipes = [
  { id: 101, household: 'Spencer', parent: null },     // Original
  { id: 201, household: 'Johnson', parent: 101 },     // Johnson's copy
  { id: 301, household: 'Williams', parent: 201 },    // Williams' copy of Johnson's copy
];
```

### Test Execution Strategy

1. **Unit Tests**: Run during development for immediate feedback
2. **Integration Tests**: Run on every commit to validate complete flows  
3. **Performance Tests**: Run weekly to catch performance regressions
4. **Security Tests**: Run on every deployment to validate household isolation
5. **Load Tests**: Run monthly with production-scale data

## Function Signature Changes & Agent 3 Integration Reference

### Updated Existing Query Functions
**Agent 3 must update these function calls to include `household_id` parameter:**

#### In `/src/lib/queries/collections.ts`:
```typescript
// BEFORE: export async function getCollectionById(id: number): Promise<Collection | null>
// AFTER:  export async function getCollectionById(id: number, household_id: number): Promise<Collection | null>
```

#### In `/src/lib/queries/menus.ts`:
```typescript
// BEFORE: export async function getAllRecipesWithDetails(collectionId?: number): Promise<Recipe[]>
// AFTER:  export async function getAllRecipesWithDetails(household_id: number, collectionId?: number): Promise<Recipe[]>

// BEFORE: export async function getRecipeDetails(id: string): Promise<RecipeDetail | null>
// AFTER:  export async function getRecipeDetails(id: string, household_id: number): Promise<Recipe | null>

// RENAMED: getRecipesForRandomization() → getMyRecipes()
// BEFORE: export async function getRecipesForRandomization(): Promise<Recipe[]>
// AFTER:  export async function getMyRecipes(household_id: number): Promise<Recipe[]>
```

### New Query Files Created
**Agent 3 can import these new functions:**

#### `/src/lib/queries/subscriptions.ts`:
```typescript
export async function subscribeToCollection(household_id: number, collection_id: number): Promise<boolean>
export async function unsubscribeFromCollection(household_id: number, collection_id: number): Promise<boolean>
export async function getSubscribedCollections(household_id: number): Promise<Collection[]>
export async function isSubscribed(household_id: number, collection_id: number): Promise<boolean>
```

#### `/src/lib/queries/search.ts`:
```typescript
export async function searchRecipesWithPrecedence(searchTerm: string, household_id: number, collectionId?: number): Promise<Recipe[]>
export function filterRecipesClientSide(recipes: Recipe[], searchTerm: string): Recipe[]
```

#### `/src/lib/queries/validation.ts`:
```typescript
export async function validateCollectionAccess(collectionId: number, household_id: number): Promise<'owned' | 'subscribed' | 'public' | null>
export async function validateRecipeAccess(recipeId: number, collectionId: number, household_id: number): Promise<boolean>
export async function validateSlugAccess(collectionSlug: string, recipeSlug: string, household_id: number): Promise<{ collection_id: number; recipe_id: number } | null>
```

### Files Requiring Import Updates
**Agent 3 must update these files to use new function signatures:**

#### Pages:
- `/src/app/recipes/[collection-slug]/page.tsx` - Update `getCollectionById()` and `getAllRecipesWithDetails()` calls
- `/src/app/recipes/[collection-slug]/[recipe-slug]/page.tsx` - Update `getRecipeDetails()` call
- `/src/app/plan/page.tsx` - Update `getAllRecipesWithDetails()` call

#### API Routes:
- `/src/app/api/plan/randomize/route.ts` - Change import from `getRecipesForRandomization` to `getMyRecipes`
- All API routes in Phase 5 sections - Add household_id parameter extraction from authentication middleware

### Authentication Context Integration
**Agent 3 will consume these interfaces from Agent 2:**

```typescript
// From src/lib/auth.ts
interface SessionUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  household_id: number;  // NEW
  household_name: string; // NEW
}

// From src/lib/middleware/withAuth.ts  
interface AuthenticatedRequest extends NextRequest {
  user: SessionUser;
  household_id: number; // NEW: direct access for API handlers
}
```

## Integration Points with Agent 3

### Provide to Agent 3:
- SessionUser interface with household context for AuthContext consumption
- Completed authentication middleware with household_id injection
- Completed API endpoints with proper household context
- Query functions for frontend data fetching
- Subscription management APIs for UI components
- Permission checking utilities for frontend validation

### Coordinate with Agent 3:
- Authentication context integration (household_id from session)
- Error handling patterns for permission denied scenarios
- Loading states for copy-on-write operations
- Subscription status UI state management

## Handoff Documentation

Upon completion, provide:
- Authentication system documentation with SessionUser interface specification
- API middleware integration guide showing household context injection
- Complete API endpoint documentation with examples
- Query function reference with performance characteristics  
- Copy-on-write integration guide for frontend developers
- Subscription management integration examples
- Performance benchmarking results and optimization recommendations