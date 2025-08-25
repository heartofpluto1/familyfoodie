# Agent 2: Authentication, Query & API Implementation

**Parent Spec:** [005-household-feature-spec.md](../specs/005-household-feature-spec.md)  
**Agent Role:** Authentication Foundation & API Development Specialist  
**Assigned Sections:** Authentication Layer (§0), Optimized Query Logic (§3), Application Layer Changes (§6)

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
// Core household-scoped queries maintaining existing interfaces
export async function getMyRecipes(household_id: number) // Owned + subscribed for meal planning (remove duplicates - prioritise owned)
export async function getAllRecipesWithDetails(household_id: number, collectionId?: number) // Enhanced for search
export async function getRecipeDetails(id: string, household_id: number) // Single recipe with precedence
export async function getMyIngredients(household_id: number) // Enhanced discovery access
export async function getMyCollections(household_id: number) // Owned + subscribed only (remove duplicates - prioritise owned)
export async function getPublicCollections(household_id: number) // Public browsing/discovery
export async function getCollectionById(id: number, household_id: number) // Single collection access
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

// Original optimized collection copying (still used for subscription scenarios)
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
    
    // Copy junction records (12 bytes each vs 500+ bytes for recipe records)
    const junctionQuery = `
      INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
      SELECT ?, cr.recipe_id, NOW()
      FROM collection_recipes cr WHERE cr.collection_id = ?
    `;
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
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
// src/lib/queries/subscriptions.ts
export async function subscribeToCollection(household_id: number, collection_id: number)
export async function unsubscribeFromCollection(household_id: number, collection_id: number) 
export async function getSubscribedCollections(household_id: number)
export async function isSubscribed(household_id: number, collection_id: number)
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
// Multi-field search with household + subscribed precedence
export async function searchRecipesWithPrecedence(
  searchTerm: string,
  household_id: number,
  collectionId?: number
) {
  // Search across: recipe.name, recipe.description, season.name, ingredients
  // Apply household precedence logic
  // Maintain real-time filtering performance
  // Support URL parameter synchronization
}

// Client-side filtering for performance (pre-loaded household data)
const filteredRecipes = recipes.filter(recipe => {
  const search = searchTerm.toLowerCase();
  return recipe.name.toLowerCase().includes(search) ||
         recipe.description?.toLowerCase().includes(search) ||
         recipe.seasonName?.toLowerCase().includes(search) ||
         recipe.ingredients?.some(ingredient => ingredient.toLowerCase().includes(search));
});
```

#### Task 4.2: SEO & URL System Integration  
Implement household-aware URL validation and routing:
```typescript
// URL parsing with household context validation
export async function validateCollectionAccess(
  collectionId: number, 
  household_id: number
): Promise<'owned' | 'subscribed' | 'public' | null>

export async function validateRecipeAccess(
  recipeId: number,
  collectionId: number, 
  household_id: number
): Promise<boolean>

// SEO redirects with household-aware URL generation
// Maintain existing parseSlugPath(), parseRecipeUrl(), generateSlugFromTitle()
// Add household context to URL validation flows
```

### Phase 5: API Endpoint Development (Days 13-15)

#### Task 5.1: Update Existing Recipe Endpoints
```typescript
// Update existing recipe endpoints with household logic

// src/app/api/recipe/delete/route.ts
- Add canEditResource() permission check before deletion
- Ensure only household-owned recipes can be deleted

// src/app/api/recipe/update-details/route.ts  
- Add triggerCascadeCopyIfNeeded() before updating details
- Handle copy-on-write for non-owned recipes

// NEW: Collection context-aware recipe editing endpoint
// src/app/api/recipes/[recipe_slug]/edit/route.ts
- Add triggerCascadeCopyWithContext() for collection+recipe cascade copying
- Handle collection context from request body (collection_id)
- Return new URLs after copy-on-write operations
- Support actions_taken response for UI feedback

// src/app/api/recipe/update-ingredients/route.ts
- Add triggerCascadeCopyIfNeeded() before updating ingredients
- Handle ingredient copy-on-write as well

// src/app/api/recipe/update-image/route.ts
- Add triggerCascadeCopyIfNeeded() before updating image
- Handle copy-on-write for image updates

// src/app/api/recipe/update-pdf/route.ts
- Add triggerCascadeCopyIfNeeded() before updating PDF
- Handle copy-on-write for PDF updates

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
- Add triggerCascadeCopyIfNeeded() before updating ingredients
- Handle copy-on-write for non-owned ingredients
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

// src/app/api/collections/[id]/subscribe/route.ts
POST - subscribeToCollection() for subscription management
DELETE - unsubscribeFromCollection() for unsubscribing
- Validate subscription permissions and state changes
```

## Dependencies

### Upstream Dependencies (Must Complete First)
- **Agent 1**: Completed database schema and stored procedures
- **Agent 1**: Migration completed with Spencer household and data

### Downstream Dependencies (Other Agents Depend On)
- **Agent 3**: Completed API endpoints for frontend integration
- **Agent 3**: Working subscription management for UI components

## Success Criteria

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
- Test copyCollectionOptimized() transaction handling
- Test junction table query performance vs old approach

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
- Test triggerCascadeCopyIfNeeded() before updating details
- Test copy-on-write triggered for non-owned recipes

// src/app/api/recipe/update-ingredients/route.test.ts
- Test triggerCascadeCopyIfNeeded() before updating ingredients
- Test ingredient copy-on-write integration

// src/app/api/recipe/update-image/route.test.ts
- Test triggerCascadeCopyIfNeeded() before updating image
- Test copy-on-write for image updates

// src/app/api/recipe/update-pdf/route.test.ts
- Test triggerCascadeCopyIfNeeded() before updating PDF
- Test copy-on-write for PDF updates

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
- Test triggerCascadeCopyIfNeeded() before updating ingredients
- Test copy-on-write for non-owned ingredients

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