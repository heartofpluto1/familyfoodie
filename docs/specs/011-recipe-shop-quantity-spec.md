# Recipe Shop Quantity Specification

## Executive Summary

This document specifies the implementation of customizable shopping quantities for recipes, replacing the current hardcoded 2-person serving size with a flexible system that supports both 2-person and 4-person quantities. The feature introduces recipe-level defaults and plan-level overrides while maintaining the immutability of historical plans and shopping lists.

## Business Requirements

### Problem Statement

Currently, the shopping list generation system assumes all recipes are cooked for 2 people:
- **Hardcoded Quantity:** Shopping lists always use the 2-person quantity (`ri.quantity`) from recipe ingredients
- **No Flexibility:** Users cannot specify different serving sizes for different recipes
- **Use Case Mismatch:** Baking and entertaining scenarios often require 4+ servings, but dinner recipes typically serve 2

**Example Scenarios:**
- User bakes cookies for 4 people but the shopping list only includes ingredients for 2
- User has guests for dinner and needs to cook for 4, but shopping list assumes 2
- User meal preps in batches (4+ servings) but gets insufficient ingredient quantities

### User Requirements

1. **Default Shop Quantity per Recipe:** Each recipe should have a configurable default (2p or 4p)
   - Most dinner recipes default to 2 people
   - Most baking/batch cooking recipes default to 4 people
   - Editable in recipe details and during AI import

2. **Plan-Level Override:** When adding a recipe to a weekly plan, users can override the default
   - Guest dinner: Override a 2p recipe to 4p for that week
   - Solo cooking: Override a 4p recipe to 2p for that week
   - Changes apply only to that specific week

3. **Historical Integrity:** Plans and shopping lists are immutable logs
   - Changing a recipe's default doesn't affect existing plans
   - Shopping lists generated in the past remain accurate
   - Plans capture the shop quantity decision made at that time

### Success Criteria

- ✅ Users can set default shop quantity (2p or 4p) for each recipe
- ✅ Users can override shop quantity when editing weekly plans
- ✅ Shopping lists use the correct quantity based on plan settings
- ✅ Historical plans remain unchanged when recipe defaults change
- ✅ Migration preserves existing behavior (all defaults to 2p)
- ✅ Zero breaking changes to existing functionality

## Current System Architecture

### Database Schema (Relevant Tables)

**recipes table:**
```sql
CREATE TABLE recipes (
  id INT PRIMARY KEY,
  name VARCHAR(64),
  -- ... other fields
);
```

**recipe_ingredients table:**
```sql
CREATE TABLE recipe_ingredients (
  id INT PRIMARY KEY,
  recipe_id INT,
  ingredient_id INT,
  quantity VARCHAR(16),      -- 2-person quantity
  quantity4 VARCHAR(16),     -- 4-person quantity
  quantityMeasure_id INT,
  -- ... other fields
);
```

**plans table:**
```sql
CREATE TABLE plans (
  id INT PRIMARY KEY,
  week SMALLINT,
  year SMALLINT,
  recipe_id INT,
  household_id INT
  -- Currently no shop_qty field
);
```

**shopping_lists table:**
```sql
CREATE TABLE shopping_lists (
  id INT PRIMARY KEY,
  week SMALLINT,
  year SMALLINT,
  household_id INT,
  recipe_id INT,
  quantity VARCHAR(16),       -- Denormalized from recipe_ingredients
  quantity4 VARCHAR(16),      -- Denormalized from recipe_ingredients
  -- ... other fields
);
```

### Current Shopping List Generation Logic

From `src/lib/queries/menus.ts` (`resetShoppingListFromRecipes`):

```typescript
// Currently hardcoded to always use 2-person quantities
const ingredientsQuery = `
  SELECT
    ri.quantity,        -- Always used for shopping list
    ri.quantity4,       -- Stored but not used in generation logic
    -- ... other fields
  FROM plans rw
  JOIN recipe_ingredients ri ON rw.recipe_id = ri.recipe_id
  -- ...
`;

// Shopping list items always get quantity (2p), never quantity4 (4p)
```

**Problem:** No mechanism to choose between `quantity` and `quantity4` based on user preference.

## Technical Architecture

### Design Decisions

#### Decision 1: Shop Quantity Storage in Plans Table

**Rationale:** Plans are historical logs that should remain immutable.

**Approach:**
- Add `shop_qty` to both `recipes` and `plans` tables
- When creating a plan entry, copy `recipes.shop_qty` → `plans.shop_qty`
- Users can override via UI, which saves directly to `plans.shop_qty`
- Shopping list generation uses **only** `plans.shop_qty` (no fallback to recipes)

**Benefits:**
- Historical integrity: Old plans aren't affected by recipe changes
- Single source of truth: `plans.shop_qty` is authoritative for shopping lists
- Audit trail: Plans capture the exact quantity decision made at that time
- Simplicity: No complex fallback logic in queries

#### Decision 2: Limited Quantity Options (2p and 4p Only)

**Rationale:** Database stores exact quantities for 2p and 4p only.

**Approach:**
- UI presents dropdown: "2 people" or "4 people"
- Stored as SMALLINT: 2 or 4
- Shopping list generation directly maps to `quantity` or `quantity4` columns
- No interpolation/extrapolation calculations needed

**Benefits:**
- Uses existing data without calculation complexity
- Matches database schema (quantity and quantity4 fields)
- Simpler implementation and testing
- No precision loss from calculations

**Future Enhancement:** Could add interpolation for 1p, 6p, 8p in future iterations if needed.

#### Decision 3: Copy-on-Save Pattern for Plans

**Rationale:** Plans should capture recipe configuration at time of creation.

**Approach:**
```typescript
// When adding recipe to plan:
// 1. Fetch recipe with shop_qty
// 2. Insert into plans with shop_qty copied from recipe
INSERT INTO plans (week, year, recipe_id, household_id, shop_qty)
VALUES (?, ?, ?, ?, recipe.shop_qty);

// When user overrides in UI:
// 1. User changes dropdown on recipe card
// 2. Update only that plan entry
UPDATE plans SET shop_qty = ? WHERE id = ?;
```

**Benefits:**
- Snapshot semantics: Plans capture state at creation time
- Overrides are explicit user actions
- Recipe changes don't cascade to plans
- Clear data lineage

## Database Schema Changes

### Migration 027: Add Shop Quantity Fields

**File:** `migrations/027_add_shop_qty_fields.sql`

```sql
-- Add shop_qty to recipes table with default of 2
ALTER TABLE recipes
ADD COLUMN shop_qty SMALLINT NOT NULL DEFAULT 2
COMMENT '2 or 4 people - default shopping quantity for this recipe';

-- Add shop_qty to plans table with default of 2
ALTER TABLE plans
ADD COLUMN shop_qty SMALLINT NOT NULL DEFAULT 2
COMMENT '2 or 4 people - shopping quantity for this specific plan entry';

-- Add indexes for query performance
CREATE INDEX idx_recipes_shop_qty ON recipes(shop_qty);
CREATE INDEX idx_plans_shop_qty ON plans(shop_qty);

-- Add check constraints to ensure only 2 or 4 are allowed
ALTER TABLE recipes
ADD CONSTRAINT chk_recipes_shop_qty CHECK (shop_qty IN (2, 4));

ALTER TABLE plans
ADD CONSTRAINT chk_plans_shop_qty CHECK (shop_qty IN (2, 4));
```

**Migration Safety:**
- Default value of 2 preserves current behavior
- All existing recipes get shop_qty=2 (current hardcoded behavior)
- All existing plans get shop_qty=2 (current hardcoded behavior)
- NOT NULL constraint ensures no NULL handling needed
- Check constraints prevent invalid values

**Rollback:**
```sql
ALTER TABLE recipes DROP CONSTRAINT chk_recipes_shop_qty;
ALTER TABLE plans DROP CONSTRAINT chk_plans_shop_qty;
DROP INDEX idx_recipes_shop_qty ON recipes;
DROP INDEX idx_plans_shop_qty ON plans;
ALTER TABLE recipes DROP COLUMN shop_qty;
ALTER TABLE plans DROP COLUMN shop_qty;
```

## Business Logic Updates

### Shopping List Generation

**File:** `src/lib/queries/menus.ts`

**Function:** `resetShoppingListFromRecipes()`

**Current Implementation:**
```typescript
const ingredientsQuery = `
  SELECT
    ri.quantity,
    ri.quantity4,
    -- ... other fields
  FROM plans rw
  JOIN recipe_ingredients ri ON rw.recipe_id = ri.recipe_id
  -- ...
`;

// Always uses ri.quantity (2p)
const insertValues = ingredients.map(ingredient => [
  // ...
  ingredient.quantity,   // Always 2p
  ingredient.quantity4,  // Stored but unused
  // ...
]);
```

**New Implementation:**
```typescript
const ingredientsQuery = `
  SELECT
    ri.id as recipeIngredient_id,
    ri.recipe_id,
    -- Use plans.shop_qty to select correct quantity
    CASE
      WHEN rw.shop_qty = 4 THEN ri.quantity4
      ELSE ri.quantity
    END as selected_quantity,
    ri.quantity as quantity,      -- Keep for backward compatibility
    ri.quantity4 as quantity4,    -- Keep for backward compatibility
    ri.quantityMeasure_id,
    i.name as ingredient_name,
    -- ... other fields
  FROM plans rw
  JOIN recipe_ingredients ri ON rw.recipe_id = ri.recipe_id
  JOIN recipes r ON rw.recipe_id = r.id
  JOIN ingredients i ON ri.ingredient_id = i.id
  LEFT JOIN measurements m ON ri.quantityMeasure_id = m.id
  WHERE rw.week = ? AND rw.year = ? AND rw.household_id = ?
  -- ...
`;

const insertValues = ingredients.map((ingredient, index) => [
  week,
  year,
  householdId,
  ingredient.fresh,
  ingredient.ingredient_name,
  index,
  ingredient.cost,
  ingredient.recipeIngredient_id,
  0, // purchased = false
  ingredient.stockcode,
  ingredient.recipe_id,
  ingredient.selected_quantity,  // NEW: Uses shop_qty to select quantity
  ingredient.quantity4,           // Keep for reference
  ingredient.measure_name,
]);
```

**Alternative Implementation (Denormalize at Shopping List Level):**

If we want shopping lists to be even more independent, we could store only the selected quantity:

```typescript
// Don't store both quantity and quantity4 in shopping_lists
// Store only the selected quantity based on shop_qty at generation time
const insertValues = ingredients.map((ingredient, index) => [
  // ...
  ingredient.selected_quantity,  // Only store the one actually used
  // Remove quantity4 from shopping_lists entirely
]);
```

**Decision:** Keep both quantities in shopping_lists for now (backward compatibility), but use selected_quantity for display.

### Plan Save Logic

**File:** `src/app/api/plan/save/route.ts` (or similar)

**Current Implementation:**
```typescript
// Insert plan entries without shop_qty
await pool.execute(
  'INSERT INTO plans (week, year, recipe_id, household_id) VALUES (?, ?, ?, ?)',
  [week, year, recipeId, householdId]
);
```

**New Implementation:**
```typescript
// Fetch recipe with shop_qty to copy default
const [recipeRows] = await pool.execute(
  'SELECT shop_qty FROM recipes WHERE id = ?',
  [recipeId]
);
const recipe = recipeRows[0];

// Insert plan entry with shop_qty copied from recipe
await pool.execute(
  'INSERT INTO plans (week, year, recipe_id, household_id, shop_qty) VALUES (?, ?, ?, ?, ?)',
  [week, year, recipeId, householdId, recipe.shop_qty]
);
```

**When User Overrides in UI:**
```typescript
// Update specific plan entry with user's override
await pool.execute(
  'UPDATE plans SET shop_qty = ? WHERE id = ?',
  [newShopQty, planId]
);
```

## Type Definitions

### Recipe Interface

**File:** `src/types/menus.ts`

```typescript
export interface Recipe {
  id: number;
  name: string;
  // ... existing fields
  shop_qty: 2 | 4; // NEW: Default shop quantity
}

export interface RecipeDetail extends Recipe {
  // ... existing fields
  shop_qty: 2 | 4; // Inherited from Recipe
}
```

### Plan Interface

**File:** `src/types/plan.ts` (or menus.ts)

```typescript
export interface PlanEntry {
  id: number;
  week: number;
  year: number;
  recipe_id: number;
  household_id: number;
  shop_qty: 2 | 4; // NEW: Shop quantity for this plan entry
}
```

### API Request/Response Types

```typescript
// Recipe update request
export interface UpdateRecipeDetailsRequest {
  id: number;
  name: string;
  // ... existing fields
  shop_qty?: 2 | 4; // NEW: Optional shop quantity
}

// Plan save request
export interface SavePlanRequest {
  week: number;
  year: number;
  recipes: Array<{
    id: number;
    shop_qty?: 2 | 4; // NEW: Override default if provided
  }>;
}

// Plan update shop quantity request
export interface UpdatePlanShopQtyRequest {
  planId: number;
  shop_qty: 2 | 4;
}
```

## UI Components

### 1. Recipe Edit Forms

#### Recipe Details Edit Page

**File:** `src/app/recipes/[collection-slug]/[recipe-slug]/components/RecipeForm.tsx`

**Location:** Add to recipe metadata section (near prepTime, cookTime, season, types)

**Component:**
```tsx
{/* Shop Quantity */}
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    Default Shop Quantity
  </label>
  <select
    value={formData.shop_qty || 2}
    onChange={e => handleFieldChange('shop_qty', parseInt(e.target.value))}
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm"
  >
    <option value={2}>2 people</option>
    <option value={4}>4 people</option>
  </select>
  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
    Default serving size when adding to meal plans
  </p>
</div>
```

#### AI Import Form

**File:** `src/app/recipes/[collection-slug]/import/components/RecipeDetailsForm.tsx` (or similar)

**Location:** Add to recipe metadata section

**Component:** Same dropdown as above, with contextual help text:
```tsx
<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
  How many people do you typically make this recipe for?
</p>
```

### 2. Plan Page Recipe Cards

#### Recipe Card Component

**File:** `src/app/components/RecipeCard.tsx`

**Location:** Add shop quantity selector in edit mode controls area (near Swap/Remove buttons)

**Component:**
```tsx
{showControls && (
  <div className="recipe-controls">
    {/* Existing Swap/Remove buttons */}

    {/* NEW: Shop Quantity Selector */}
    <div className="shop-qty-selector">
      <label className="text-xs text-gray-600 dark:text-gray-400">
        Shop for:
      </label>
      <select
        value={recipe.shop_qty || 2}
        onChange={e => handleShopQtyChange(recipe.id, parseInt(e.target.value))}
        className="text-sm px-2 py-1 border rounded"
        title="Number of people to shop for"
      >
        <option value={2}>2 people</option>
        <option value={4}>4 people</option>
      </select>
      {recipe.shop_qty !== recipe.default_shop_qty && (
        <span className="text-xs text-blue-600" title="Overriding recipe default">
          ⚙️
        </span>
      )}
    </div>
  </div>
)}
```

**Visual Design:**
- Compact dropdown suitable for recipe card
- Gear icon (⚙️) indicates when overriding recipe default
- Tooltip explains what the setting does
- Only visible in edit mode

**Props Update:**
```typescript
interface RecipeCardProps {
  recipe: Recipe & {
    shop_qty: 2 | 4;           // Current shop_qty from plan
    default_shop_qty?: 2 | 4;  // Recipe's default (for comparison)
  };
  showControls?: boolean;
  onShopQtyChange?: (recipeId: number, shopQty: 2 | 4) => void; // NEW
  // ... existing props
}
```

### 3. Shop Quantity Indicator (View Mode)

When not in edit mode, show shop quantity as informational badge:

```tsx
{!showControls && recipe.shop_qty === 4 && (
  <span className="shop-qty-badge" title="Shopping for 4 people">
    4p
  </span>
)}
```

**Styling:** Small badge near recipe name or timing info, only shown if non-default (4p).

## API Changes

### Recipe Update API

**File:** `src/app/api/recipe/update-details/route.ts`

**Changes:**

1. Add `shop_qty` to request interface:
```typescript
interface UpdateRecipeDetailsRequest {
  id: number | string;
  name: string;
  // ... existing fields
  shop_qty?: number | null; // NEW
}
```

2. Add validation:
```typescript
// Validate shop_qty if provided
if (shop_qty !== undefined && shop_qty !== null) {
  if (typeof shop_qty !== 'number' || ![2, 4].includes(shop_qty)) {
    return NextResponse.json(
      { error: 'Shop quantity must be 2 or 4' },
      { status: 400 }
    );
  }
}

const safeShopQty = shop_qty === undefined ? null : shop_qty;
```

3. Update SQL:
```typescript
const [result] = await pool.execute(
  `UPDATE recipes
   SET name = ?, description = ?, prepTime = ?, cookTime = ?,
       season_id = ?, primaryType_id = ?, secondaryType_id = ?, shop_qty = ?
   WHERE id = ?`,
  [trimmedName, safeDescription, safePrepTime, safeCookTime,
   safeSeasonId, safePrimaryTypeId, safeSecondaryTypeId, safeShopQty, actualRecipeId]
);
```

### Plan Update API

**New File:** `src/app/api/plan/update-shop-qty/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { requireAuth } from '@/lib/auth/helpers';

interface UpdatePlanShopQtyRequest {
  planId: number;
  shop_qty: 2 | 4;
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const body: UpdatePlanShopQtyRequest = await request.json();
  const { planId, shop_qty } = body;

  // Validate
  if (!planId || ![2, 4].includes(shop_qty)) {
    return NextResponse.json(
      { error: 'Invalid plan ID or shop quantity' },
      { status: 400 }
    );
  }

  // Verify plan belongs to user's household
  const [planRows] = await pool.execute(
    'SELECT household_id FROM plans WHERE id = ?',
    [planId]
  );

  if (!planRows[0] || planRows[0].household_id !== auth.household_id) {
    return NextResponse.json(
      { error: 'Plan not found' },
      { status: 404 }
    );
  }

  // Update shop_qty
  await pool.execute(
    'UPDATE plans SET shop_qty = ? WHERE id = ?',
    [shop_qty, planId]
  );

  return NextResponse.json({ success: true, shop_qty });
}
```

**Alternative:** Modify existing plan save API instead of creating new endpoint.

### Plan Save API

**File:** `src/app/api/plan/save/route.ts`

**Changes:**

1. Update request interface:
```typescript
interface SavePlanRequest {
  week: number;
  year: number;
  recipeIds: number[];
  shopQuantities?: { [recipeId: number]: 2 | 4 }; // NEW: Optional overrides
}
```

2. Fetch recipe defaults and apply overrides:
```typescript
// Fetch recipes with their shop_qty defaults
const [recipes] = await pool.execute(
  `SELECT id, shop_qty FROM recipes WHERE id IN (${placeholders})`,
  recipeIds
);

// Build insert values with shop_qty
const insertValues = recipeIds.map(recipeId => {
  const recipe = recipes.find(r => r.id === recipeId);
  const shopQty = shopQuantities?.[recipeId] || recipe.shop_qty || 2;

  return [week, year, recipeId, auth.household_id, shopQty];
});

// Insert with shop_qty
await pool.execute(
  `INSERT INTO plans (week, year, recipe_id, household_id, shop_qty)
   VALUES ${placeholders}`,
  insertValues.flat()
);
```

## Testing Strategy

### Unit Tests

**File:** `src/lib/queries/menus.test.ts`

1. **Shopping list generation with shop_qty=2:**
```typescript
test('generates shopping list with 2p quantities when shop_qty=2', async () => {
  // Setup plan with shop_qty=2
  // Generate shopping list
  // Verify uses ri.quantity, not ri.quantity4
});
```

2. **Shopping list generation with shop_qty=4:**
```typescript
test('generates shopping list with 4p quantities when shop_qty=4', async () => {
  // Setup plan with shop_qty=4
  // Generate shopping list
  // Verify uses ri.quantity4, not ri.quantity
});
```

3. **Mixed shop quantities in same week:**
```typescript
test('handles mixed shop quantities in same week', async () => {
  // Plan has 3 recipes: 2p, 4p, 2p
  // Generate shopping list
  // Verify each recipe uses correct quantity
});
```

4. **Historical integrity:**
```typescript
test('changing recipe shop_qty does not affect existing plans', async () => {
  // Create plan with recipe (shop_qty=2)
  // Generate shopping list (should use 2p)
  // Change recipe shop_qty to 4
  // Regenerate shopping list for same week
  // Verify still uses 2p (from plan, not recipe)
});
```

### API Tests

**File:** `src/app/api/recipe/update-details/route.test.ts`

1. **Update recipe shop_qty:**
```typescript
test('successfully updates recipe shop_qty', async () => {
  const response = await fetch({
    method: 'PUT',
    body: JSON.stringify({
      id: 1,
      name: 'Test Recipe',
      shop_qty: 4,
    }),
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.shop_qty).toBe(4);
});
```

2. **Validate shop_qty values:**
```typescript
test('rejects invalid shop_qty values', async () => {
  const response = await fetch({
    method: 'PUT',
    body: JSON.stringify({
      id: 1,
      name: 'Test Recipe',
      shop_qty: 3, // Invalid - must be 2 or 4
    }),
  });

  expect(response.status).toBe(400);
});
```

**File:** `src/app/api/plan/update-shop-qty/route.test.ts`

1. **Update plan shop_qty:**
```typescript
test('successfully updates plan shop_qty', async () => {
  // Create plan
  // Update shop_qty via API
  // Verify change persisted
});
```

2. **Permission check:**
```typescript
test('prevents updating plans from other households', async () => {
  // Create plan for household A
  // Attempt update as household B
  // Verify 404 response
});
```

### Integration Tests

**File:** `src/app/plan/plan-client.test.tsx` (or E2E)

1. **Plan creation copies recipe shop_qty:**
```typescript
test('new plan entry copies recipe default shop_qty', async () => {
  // Create recipe with shop_qty=4
  // Add to plan
  // Verify plan.shop_qty=4
});
```

2. **Override persists across page loads:**
```typescript
test('shop_qty override persists', async () => {
  // Add recipe with shop_qty=2 to plan
  // Override to 4 via UI
  // Reload page
  // Verify still shows 4
});
```

3. **Shopping list uses correct quantities:**
```typescript
test('shopping list reflects plan shop_qty', async () => {
  // Add recipe with 2p default
  // Override to 4p in plan
  // Generate shopping list
  // Verify quantities are 4p amounts
});
```

### Manual Testing Checklist

- [ ] Create new recipe with shop_qty=4, verify saves correctly
- [ ] Edit existing recipe shop_qty from 2→4, verify updates
- [ ] Add recipe to plan, verify shop_qty copied from recipe
- [ ] Override shop_qty in plan, verify persists
- [ ] Change recipe shop_qty, verify doesn't affect existing plan
- [ ] Generate shopping list with shop_qty=2, verify 2p quantities
- [ ] Generate shopping list with shop_qty=4, verify 4p quantities
- [ ] Week with mixed shop quantities (2p and 4p), verify all correct
- [ ] AI import with shop_qty selection, verify saves
- [ ] Visual indicator shows override status correctly

## Migration Plan

### Phase 1: Database Migration

**File:** `migrations/027_add_shop_qty_fields.sql`

**Execution:**
```bash
npm run migrate
```

**Verification:**
```sql
-- Verify columns added
DESCRIBE recipes;
DESCRIBE plans;

-- Verify all existing records have shop_qty=2
SELECT COUNT(*) FROM recipes WHERE shop_qty = 2;
SELECT COUNT(*) FROM plans WHERE shop_qty = 2;

-- Verify constraints
SHOW CREATE TABLE recipes;
SHOW CREATE TABLE plans;
```

### Phase 2: Backend Implementation

**Order of Implementation:**

1. Update TypeScript interfaces (`src/types/`)
2. Update shopping list generation query (`src/lib/queries/menus.ts`)
3. Update recipe update API (`src/app/api/recipe/update-details/route.ts`)
4. Create plan shop_qty update API (new file)
5. Update plan save logic to copy shop_qty from recipes
6. Add unit tests for all new logic
7. Run full test suite and verify passing

### Phase 3: Frontend Implementation

**Order of Implementation:**

1. Update Recipe interfaces in components
2. Add shop_qty dropdown to RecipeForm
3. Add shop_qty dropdown to AI import form
4. Add shop_qty selector to RecipeCard (edit mode)
5. Add visual indicator for overrides
6. Implement onShopQtyChange handler
7. Wire up API calls

### Phase 4: Testing and Validation

**Checklist:**

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual test all UI components
- [ ] Test migration on staging database
- [ ] Performance test shopping list generation
- [ ] Browser compatibility testing

### Phase 5: Deployment

**Steps:**

1. Deploy database migration to production
2. Verify migration successful (all shop_qty = 2)
3. Deploy backend code
4. Deploy frontend code
5. Monitor error logs for issues
6. Test end-to-end in production

**Rollback Plan:**

If critical issues arise:

1. Revert frontend code deployment
2. Revert backend code deployment
3. Optionally rollback database migration (if severe data issues)

**Note:** Database rollback not necessary if only code has issues, since default values preserve existing behavior.

## Success Metrics

### Week 1 Post-Deployment

- [ ] Zero errors related to shop_qty functionality
- [ ] Migration completed successfully (all shop_qty = 2)
- [ ] Shopping lists generate correctly with both 2p and 4p
- [ ] No reports of incorrect ingredient quantities

### Week 4 Post-Deployment

- [ ] Users setting shop_qty on recipes (measure adoption)
- [ ] Users overriding shop_qty in plans (measure usage)
- [ ] Feedback indicates feature solves baking/batch cooking use cases
- [ ] No regression in shopping list accuracy

### Week 12 Post-Deployment

- [ ] Feature widely adopted by active users
- [ ] Positive sentiment around flexible quantities
- [ ] No ongoing bugs or edge cases
- [ ] Consider future enhancements (6p, 8p, etc.)

## Future Enhancements

Potential improvements for future iterations:

1. **Additional Quantity Options:** Support 1p, 6p, 8p with interpolation
2. **Smart Defaults:** ML-based suggestion of shop_qty based on recipe type
3. **Batch Operations:** Set shop_qty for multiple recipes at once
4. **Quick Actions:** "Cook for guests" button to temporarily set all to 4p
5. **Quantity History:** Analytics on which recipes are commonly 2p vs 4p
6. **Recipe Scaling:** Real-time preview of ingredient changes when changing quantity
7. **Shopping List Grouping:** Group ingredients by quantity size in shop view

## Appendix

### Database Query Examples

**Shopping list generation (before):**
```sql
SELECT
  ri.quantity,        -- Always 2p
  ri.quantity4        -- Stored but unused
FROM plans rw
JOIN recipe_ingredients ri ON rw.recipe_id = ri.recipe_id
```

**Shopping list generation (after):**
```sql
SELECT
  CASE
    WHEN rw.shop_qty = 4 THEN ri.quantity4
    ELSE ri.quantity
  END as selected_quantity,
  rw.shop_qty,
  ri.quantity,
  ri.quantity4
FROM plans rw
JOIN recipe_ingredients ri ON rw.recipe_id = ri.recipe_id
```

### API Request/Response Examples

**Update recipe shop_qty:**
```json
// Request
PUT /api/recipe/update-details
{
  "id": 42,
  "name": "Chocolate Chip Cookies",
  "shop_qty": 4
}

// Response
{
  "success": true,
  "name": "Chocolate Chip Cookies",
  "shop_qty": 4
}
```

**Update plan shop_qty:**
```json
// Request
PUT /api/plan/update-shop-qty
{
  "planId": 123,
  "shop_qty": 4
}

// Response
{
  "success": true,
  "shop_qty": 4
}
```

### UI Mockups

**Recipe Card (Edit Mode):**
```
┌─────────────────────────────┐
│ Chocolate Chip Cookies      │
│ [Image]                     │
│                             │
│ 🕐 Prep: 15m  Cook: 12m     │
│                             │
│ Shop for: [4 people ▼] ⚙️   │
│                             │
│ [Swap] [Remove]             │
└─────────────────────────────┘
```
⚙️ = Override indicator (only shown when different from recipe default)

**Recipe Form (Edit Details):**
```
┌─────────────────────────────────────┐
│ Recipe Details                      │
├─────────────────────────────────────┤
│ Name: [________________]            │
│                                     │
│ Prep Time: [15] minutes             │
│ Cook Time: [12] minutes             │
│                                     │
│ Default Shop Quantity:              │
│ ○ 2 people                          │
│ ● 4 people                          │
│ ℹ️ Default serving size when        │
│    adding to meal plans             │
│                                     │
│ Season: [Summer ▼]                  │
│ Protein: [None ▼]                   │
│ Carb: [None ▼]                      │
└─────────────────────────────────────┘
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-26
**Status:** Draft - Awaiting Implementation
