# Issue 003: URL Generation Query Optimization

## Problem Description

Currently, database queries are fetching unnecessary fields (`collection_id`, `collection_title`, `recipe_id`, `recipe_name`) primarily for URL generation, when the `collection_url_slug` and `recipe_url_slug` fields should be sufficient. This creates several issues:

### Current Issues

1. **Query Bloat**: Every recipe query fetches 3 collection fields when only 1 is needed for URLs
2. **Unnecessary JOINs**: Complex JOIN operations to fetch collection titles for fallback URL generation
3. **Fallback Logic Complexity**: URL generation has multiple fallback paths that should be unnecessary
4. **Performance Impact**: Larger result sets and more complex queries than needed
5. **Code Maintenance**: Complex URL generation logic with multiple dependencies

### Current URL Generation Logic

```typescript
// Current complex logic requiring multiple fields
export function generateRecipeUrl(recipe: Recipe): string {
    const collectionSlug = recipe.collection_url_slug
        ? generateSlugPath(recipe.collection_id, recipe.collection_url_slug) 
        : generateSlugFromTitle(recipe.collection_id, recipe.collection_title); // fallback
    const recipeSlug = recipe.url_slug 
        ? generateSlugPath(recipe.id, recipe.url_slug) 
        : generateSlugFromTitle(recipe.id, recipe.name); // fallback
    return `/recipes/${collectionSlug}/${recipeSlug}`;
}
```

### Database Query Example

```sql
-- Current: Fetches 3+ fields for URLs
SELECT 
    r.id,
    r.name,
    r.collection_id,
    c.title as collection_title,
    c.url_slug as collection_url_slug
FROM recipes r
INNER JOIN collections c ON r.collection_id = c.id
```

## Proposed Solution

### Phase 1: Simplify URL Generation

Remove all fallback logic and make slug fields mandatory:

```typescript
// Simplified logic requiring only slug fields
export function generateRecipeUrl(recipe: Recipe): string {
    return `/recipes/${recipe.collection_url_slug}/${recipe.url_slug}`;
}
```

### Phase 2: Database Query Optimization

**Queries Safe to Optimize** (only use fields for URL generation):
1. `getRecipeWeeks()` - Remove `collection_id`, `collection_title`
2. `getCurrentWeekRecipes()` - Remove `collection_id`, `collection_title`  
3. `getNextWeekRecipes()` - Remove `collection_id`, `collection_title`
4. `getAllPlannedWeeks()` - Remove `collection_id`, `collection_title`
5. `getRecipesForRandomization()` - Remove `collection_id`, `collection_title`

**Queries That Must Keep Fields** (used for business logic):
- `getAllRecipes(collectionId?)` - `collectionId` parameter used for filtering
- `getAllRecipesWithDetails(collectionId?)` - `collectionId` parameter used for filtering
- Insights queries - Fields used for display/grouping
- Recipe editors - Fields used for forms/updates
- Recipe detail pages - `collection_id` used for validation

### Phase 3: Optimized Queries

```sql
-- Optimized: Only fetch what's needed
SELECT 
    r.image_filename,
    r.pdf_filename,
    r.url_slug,
    c.url_slug as collection_url_slug
FROM recipes r
INNER JOIN collections c ON r.collection_id = c.id
```

## Expected Benefits

### Performance Improvements
- **Reduced Query Size**: 2-3 fewer fields per recipe in 5+ queries
- **Faster JOINs**: Simpler result sets
- **Network Efficiency**: Less data transferred

### Code Quality Improvements  
- **Simplified Logic**: URL generation becomes trivial
- **Reduced Complexity**: Eliminate fallback paths
- **Better Maintainability**: Single source of truth for URLs
- **Type Safety**: Slug fields guaranteed to exist

### Maintainability Benefits
- **Easier Debugging**: Simple URL generation logic
- **Future-proof**: Slug fields serve intended purpose
- **Consistent**: URL structure becomes predictable

## Implementation Plan

### Step 1: URL Helper Refactor
- Remove fallback logic from `generateRecipeUrl()`
- Make `collection_url_slug` and `url_slug` mandatory
- Update TypeScript interfaces if needed

### Step 2: Query Optimization
- Audit each query to identify which fields are actually used
- Remove `collection_id`, `collection_title` from URL-only queries
- Keep fields where used for business logic beyond URLs

### Step 3: Testing
- Verify URL generation works correctly
- Ensure no components break from missing fields
- Performance testing on optimized queries

### Step 4: Type Updates
- Update interfaces to reflect simplified structure
- Ensure type safety across components

## Risk Assessment

### Low Risk
- URL helper simplification (isolated change)
- Removing unused fields from queries (safe if properly audited)

### Medium Risk  
- Components depending on removed fields (mitigated by thorough audit)
- URL slug data quality (existing fields should be populated)

### Mitigation Strategies
- Comprehensive audit of field usage before removal
- Gradual rollout starting with lowest-risk queries
- Monitoring for any broken URLs or missing data

## Success Metrics

- **Query Performance**: Measure query execution time before/after
- **Code Complexity**: Reduce lines of code in URL generation
- **Maintainability**: Simplified debugging and future changes
- **Data Transfer**: Reduced payload sizes in API responses

## Related Issues

- Issue 001: Recipe file cache busting (related to URL structure)
- Previous work on URL slug implementation (Migration 013)