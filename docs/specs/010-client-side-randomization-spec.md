# Client-Side Recipe Randomization Specification

## Executive Summary

This document specifies the migration of recipe randomization logic from server-side API calls to client-side execution. The change eliminates network latency, improves user experience with instant recipe selection, and reduces server load by removing an unnecessary API endpoint and database query.

## Business Requirements

### Problem Statement
Currently, recipe randomization requires 5 different hooks to make API calls to `/api/plan/randomize`, resulting in:
- Noticeable latency during recipe selection (network round-trip + database query)
- Unnecessary server load with 8 total API calls across the meal planning workflow
- Poor user experience with loading states and delays
- Duplicated logic between server and client (same randomization algorithm)
- Complex filtering logic on server-side (6-month exclusion) that isn't actually needed

### Success Criteria
- Recipe randomization executes instantly (< 50ms) with no network delay
- All 5 randomization scenarios work correctly
- Maintains ingredient constraint logic (no duplicate primary/secondary ingredients)
- Excludes recipes already in the current plan (no duplicates within a week)
- Zero breaking changes to user-facing functionality
- API endpoint and database query completely removed
- Simpler logic than current implementation (no 6-month tracking needed)

## Technical Architecture

### Current Architecture (Server-Side)

```
User Action → Hook → planService.randomizeRecipes() →
API Call (/api/plan/randomize) → getRecipesForRandomization() →
Database Query (MySQL) → Filter & Randomize → Response →
Hook Updates State
```

**Issues:**
- Network latency: ~100-300ms per API call
- Database load: 8 queries during typical meal planning session
- Duplicated code: `selectRandomRecipes()` exists in both API route and server page
- Unnecessary data transfer: Recipes already available client-side

### New Architecture (Client-Side)

```
User Action → Hook → selectRandomRecipes(allRecipes, excludeIds) →
Filter & Randomize (in-memory) → Hook Updates State
```

**Benefits:**
- Instant execution: < 50ms (no network)
- No database queries needed
- Single source of truth for randomization logic
- Works offline

## Implementation Details

### 1. Client-Side Randomization Utility

**File:** `src/app/plan/utils/randomizeRecipes.ts`

```typescript
import { Recipe } from '@/types/menus';

/**
 * Select random recipes with progressive protein/carb type filtering
 *
 * @param allRecipes - All available recipes
 * @param excludeRecipeIds - Set of recipe IDs to exclude (recipes already in current plan)
 * @param count - Number of recipes to select
 * @returns Array of randomly selected recipes
 *
 * Database Schema Context:
 * - recipes.primaryType_id → type_proteins (e.g., "Chicken", "Beef", "Fish")
 * - recipes.secondaryType_id → type_carbs (e.g., "Rice", "Pasta", "Quinoa")
 * - These are stored as primaryTypeName and secondaryTypeName in the Recipe type
 *
 * Algorithm (Progressive Filtering for True Randomness):
 * 1. Filter out excluded recipes (already in current plan)
 * 2. Randomly select ONE recipe from available pool
 * 3. Add to selection and track its primaryTypeName (protein) and secondaryTypeName (carb)
 * 4. Remove ALL recipes where:
 *    - primaryTypeName matches ANY selected primaryTypeName
 *    - OR secondaryTypeName matches ANY selected secondaryTypeName
 * 5. Repeat steps 2-4 until we have 'count' recipes or pool is exhausted
 *
 * Example:
 * - Select Recipe A: primaryTypeName="Chicken", secondaryTypeName="Rice"
 * - Remove all recipes with primaryTypeName="Chicken" OR secondaryTypeName="Rice"
 * - Select Recipe B: primaryTypeName="Beef", secondaryTypeName="Pasta"
 * - Remove all recipes with primaryTypeName="Beef" OR secondaryTypeName="Pasta"
 * - Continue until count reached
 *
 * This approach ensures:
 * - Each selection is truly random from remaining valid options
 * - No duplicate recipes within the plan
 * - No identical protein types (primaryTypeName) across selected recipes
 * - No identical carb types (secondaryTypeName) across selected recipes
 * - Progressive whittling of available pool based on type constraints
 * - Different results each time due to random selection at each step
 */
export function selectRandomRecipes(
  allRecipes: Recipe[],
  excludeRecipeIds: Set<number>,
  count: number = 3
): Recipe[] {
  const selected: Recipe[] = [];
  const usedPrimaryTypes = new Set<string>();
  const usedSecondaryTypes = new Set<string>();

  // Filter out excluded recipes (already in current plan)
  let availableRecipes = allRecipes.filter(
    recipe => !excludeRecipeIds.has(recipe.id)
  );

  // Progressive filtering: randomly select and remove conflicting recipes
  while (selected.length < count && availableRecipes.length > 0) {
    // Randomly select ONE recipe from current available pool
    const randomIndex = Math.floor(Math.random() * availableRecipes.length);
    const selectedRecipe = availableRecipes[randomIndex];

    // Add to selection
    selected.push(selectedRecipe);

    // Track protein/carb types from selected recipe
    const primaryType = selectedRecipe.primaryTypeName;
    const secondaryType = selectedRecipe.secondaryTypeName;

    if (primaryType) {
      usedPrimaryTypes.add(primaryType);
    }
    if (secondaryType) {
      usedSecondaryTypes.add(secondaryType);
    }

    // Remove ALL recipes where:
    // - Their primaryTypeName matches ANY already-selected primaryTypeName
    // - Their secondaryTypeName matches ANY already-selected secondaryTypeName
    availableRecipes = availableRecipes.filter(recipe => {
      const hasPrimaryConflict = recipe.primaryTypeName &&
        usedPrimaryTypes.has(recipe.primaryTypeName);
      const hasSecondaryConflict = recipe.secondaryTypeName &&
        usedSecondaryTypes.has(recipe.secondaryTypeName);

      // Keep recipe only if it has NO conflicts
      return !hasPrimaryConflict && !hasSecondaryConflict;
    });
  }

  return selected;
}
```

### 2. Hook Updates

**IMPORTANT:** Each hook must pass recipes already in the current plan to avoid duplicates within the week.

**usePlanActions.ts** - Replace 2 API calls:

```typescript
// BEFORE: API call
const result = await planService.randomizeRecipes(3);
if (result.success && result.recipes) {
  setRecipes(result.recipes);
}

// AFTER: Client-side (handleEdit - new week with no recipes)
const excludeSet = new Set(); // Empty week, nothing to exclude
const randomRecipes = selectRandomRecipes(allRecipes, excludeSet, 3);
setRecipes(randomRecipes);

// AFTER: Client-side (handleAutomate - replacing existing recipes)
const excludeSet = new Set(); // Replacing all, don't exclude current recipes
const randomRecipes = selectRandomRecipes(allRecipes, excludeSet, recipes.length);
setRecipes(randomRecipes);
```

**useRecipeManagement.ts** - Replace 2 API calls:

```typescript
// BEFORE: API call for swap
const result = await planService.randomizeRecipes(1);

// AFTER: Client-side (handleSwapRecipe - exclude current plan)
const excludeSet = new Set(recipes.map(r => r.id)); // Don't pick recipes already in plan
const [replacement] = selectRandomRecipes(allRecipes, excludeSet, 1);

// BEFORE: API call for add random
const result = await planService.randomizeRecipes(1);

// AFTER: Client-side (handleAddRandomRecipe - exclude current plan)
const excludeSet = new Set(recipes.map(r => r.id)); // Don't pick recipes already in plan
const [newRecipe] = selectRandomRecipes(allRecipes, excludeSet, 1);
if (newRecipe) {
  setRecipes([...recipes, newRecipe]);
}
```

**useMultiWeekPlan.ts** - Replace 1 API call:

```typescript
// BEFORE: API call
const result = await planService.randomizeRecipes();

// AFTER: Client-side (addNextWeek - new week has no recipes)
const excludeSet = new Set(); // Empty week, nothing to exclude
const suggestedRecipes = selectRandomRecipes(allRecipes, excludeSet, 3);
```

### 3. Server-Side Update

**Update** `src/app/plan/page.tsx` to use shared utility:

```typescript
import { selectRandomRecipes } from './utils/randomizeRecipes';

// Replace inline selectRandomRecipes() with shared utility
const randomizedRecipes = selectRandomRecipes(availableRecipes, new Set(), 3);
```

### 4. API Cleanup

**Files to DELETE:**
- `src/app/api/plan/randomize/route.ts` - API endpoint (no longer needed)
- `src/app/api/plan/randomize/route.test.ts` - API tests (replaced by util tests)

**Files to MODIFY:**
- `src/app/plan/services/planService.ts` - Remove `randomizeRecipes()` method
- `src/lib/queries/menus.ts` - Remove `getRecipesForRandomization()` function
- `src/lib/queries/menus.test.ts` - Remove `getRecipesForRandomization()` tests

## Testing Strategy

### Unit Tests (`randomizeRecipes.test.ts`)

**Test Coverage:**

1. **Recipe Exclusion Filtering**
   ```typescript
   test('excludes recipes in excludeRecipeIds set', () => {
     const recipes = [
       { id: 1, name: 'Recipe 1', ingredients: ['chicken', 'rice'] },
       { id: 2, name: 'Recipe 2', ingredients: ['beef', 'pasta'] },
       { id: 3, name: 'Recipe 3', ingredients: ['fish', 'quinoa'] }
     ];
     const excludeSet = new Set([1, 3]);
     const result = selectRandomRecipes(recipes, excludeSet, 2);

     expect(result).toHaveLength(1);
     expect(result[0].id).toBe(2);
   });
   ```

2. **Ingredient Constraint Logic**
   ```typescript
   test('avoids duplicate primary ingredients', () => {
     const recipes = [
       { id: 1, ingredients: ['chicken', 'rice'] },
       { id: 2, ingredients: ['chicken', 'pasta'] }, // duplicate primary
       { id: 3, ingredients: ['beef', 'quinoa'] }
     ];
     const result = selectRandomRecipes(recipes, new Set(), 3);

     // Should select 1 and 3, skip 2 (duplicate primary)
     expect(result).toHaveLength(2);
     expect(result.map(r => r.id).includes(2)).toBe(false);
   });
   ```

3. **Edge Cases**
   ```typescript
   test('handles empty recipe list', () => {
     expect(selectRandomRecipes([], new Set(), 3)).toEqual([]);
   });

   test('handles count greater than available', () => {
     const recipes = [{ id: 1, ingredients: ['chicken'] }];
     const result = selectRandomRecipes(recipes, new Set(), 10);
     expect(result).toHaveLength(1);
   });

   test('excludes recipes with no ingredients', () => {
     const recipes = [
       { id: 1, ingredients: [] },
       { id: 2, ingredients: ['chicken'] }
     ];
     const result = selectRandomRecipes(recipes, new Set(), 2);
     expect(result).toHaveLength(1);
     expect(result[0].id).toBe(2);
   });
   ```

4. **Randomness Verification**
   ```typescript
   test('produces different results on multiple runs', () => {
     const recipes = Array.from({ length: 10 }, (_, i) => ({
       id: i,
       ingredients: [`ingredient${i}`, `secondary${i}`]
     }));

     const results = Array.from({ length: 5 }, () =>
       selectRandomRecipes(recipes, new Set(), 3).map(r => r.id).join(',')
     );

     const uniqueResults = new Set(results);
     expect(uniqueResults.size).toBeGreaterThan(1); // Should have variation
   });
   ```

### Integration Testing

**Manual Test Scenarios:**

1. ✅ Edit empty week → Should show 3 random recipes instantly
2. ✅ Click "Automate" → Should replace all recipes with new random selection
3. ✅ Click "Swap" on recipe → Should replace with different random recipe
4. ✅ Click "Add Random" → Should add new random recipe to week
5. ✅ Click "Add Week" → Should create new week with 3 random recipes
6. ✅ Verify recently used recipes (last 6 months) are excluded
7. ✅ Verify no duplicate primary/secondary ingredients in selection

### Build Validation

```bash
npm run lint        # Verify type safety and code quality
npm run build       # Ensure production build succeeds
npm test           # Run all unit tests including new randomize tests
```

## Migration Checklist

- [ ] Create `src/app/plan/utils/randomizeRecipes.ts` with shared utility
- [ ] Create `src/app/plan/utils/randomizeRecipes.test.ts` with comprehensive tests
- [ ] Update `src/app/plan/page.tsx` to use shared utility (remove inline function)
- [ ] Update `src/app/plan/hooks/usePlanActions.ts` (2 API calls → local)
- [ ] Update `src/app/plan/hooks/useRecipeManagement.ts` (2 API calls → local)
- [ ] Update `src/app/plan/hooks/useMultiWeekPlan.ts` (1 API call → local)
- [ ] Delete `src/app/api/plan/randomize/route.ts`
- [ ] Delete `src/app/api/plan/randomize/route.test.ts`
- [ ] Remove `randomizeRecipes()` from `src/app/plan/services/planService.ts`
- [ ] Remove `getRecipesForRandomization()` from `src/lib/queries/menus.ts`
- [ ] Remove tests from `src/lib/queries/menus.test.ts`
- [ ] Run full test suite and verify all tests pass
- [ ] Manual testing of all 5 randomization scenarios
- [ ] Performance verification (instant vs previous latency)

## Performance Impact

### Before (Server-Side)
- **Average latency per randomization:** 150-300ms (network + DB query)
- **Total latency per planning session:** ~1-2 seconds (8 API calls)
- **Database queries per session:** 8 queries
- **User experience:** Visible loading states, delays

### After (Client-Side)
- **Average execution time:** < 50ms (in-memory filtering)
- **Total time per planning session:** < 200ms (instant feedback)
- **Database queries per session:** 0 (eliminated)
- **User experience:** Instant, no loading states

**Estimated Performance Improvement:** 75-90% reduction in randomization latency

## Rollback Plan

If issues arise post-deployment:

1. **Immediate rollback:** Revert commit and redeploy previous version
2. **API restoration:** Restore deleted API route files from git history
3. **Database query:** Restore `getRecipesForRandomization()` function
4. **Hook updates:** Restore `planService.randomizeRecipes()` calls in hooks

All changes are isolated to the meal planning feature and won't affect other system components.

## Success Metrics

**Week 1 Post-Deployment:**
- Zero errors related to recipe randomization
- User feedback indicates improved responsiveness
- Server logs show elimination of `/api/plan/randomize` calls

**Week 4 Post-Deployment:**
- Performance monitoring confirms < 50ms average execution time
- No increase in bug reports related to meal planning
- Positive user sentiment around planning speed

## Future Enhancements

Potential improvements for future iterations:

1. **Smart Randomization:** Machine learning to suggest recipes based on user preferences
2. **Seasonal Weighting:** Prioritize seasonal recipes in randomization
3. **Dietary Constraints:** Filter by dietary restrictions during randomization
4. **Recipe Variety:** Track and enforce variety across multiple weeks (e.g., max 1 chicken recipe per week)
5. **User Preferences:** Weight randomization by user ratings/favorites
