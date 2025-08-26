# Meal Planning System Specification

## Executive Summary

This document captures the current meal planning system architecture in the FamilyFoodie application. The system provides week-based meal planning with intelligent recipe selection, multi-week planning capabilities, and automatic shopping list generation. This specification serves as a foundation reference before implementing household-scoped meal planning.

## Current System Overview

### Core Concepts
- **Week-Based Planning**: Uses ISO week numbers for consistent week boundaries
- **Global Planning**: All meal plans are shared across all users (no household isolation)
- **Recipe Selection**: Users can select from all available recipes across all collections
- **Shopping Integration**: Meal plans automatically generate shopping lists
- **Multi-Week Support**: Plan multiple weeks ahead with individual week management

### Business Logic
- **ISO Week Calculation**: Consistent week numbering regardless of year boundaries
- **Recipe Randomization**: Smart algorithm avoids ingredient conflicts
- **Ingredient Aggregation**: Shopping lists aggregate ingredients from multiple recipes
- **Edit States**: Complex state management for planning workflow

## Database Architecture

### Core Table: `plans`

```sql
CREATE TABLE plans (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  week SMALLINT NOT NULL,
  year SMALLINT NOT NULL,
  recipe_id INT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id)
);
```

#### Table Characteristics
- **Composite Key Logic**: (week, year, recipe_id) combination allows multiple recipes per week
- **No User Isolation**: No household_id or user_id - plans are globally shared
- **Recipe Reference**: Direct foreign key to recipes table
- **Week Range**: SMALLINT supports week numbers 1-53
- **Year Support**: SMALLINT supports years (typically current year ± few years)

#### Current Data Access Patterns
```sql
-- Get current week recipes
SELECT r.* FROM plans p 
JOIN recipes r ON p.recipe_id = r.id 
WHERE p.week = ? AND p.year = ?

-- Save week recipes (replace existing)
DELETE FROM plans WHERE week = ? AND year = ?;
INSERT INTO plans (week, year, recipe_id) VALUES (?, ?, ?), ...

-- Get all planned weeks from current forward
SELECT DISTINCT week, year FROM plans 
WHERE (year = ? AND week >= ?) OR (year > ?)
ORDER BY year ASC, week ASC
```

### Related Data Relationships

#### Recipe Access Pattern
```sql
-- Recipes available for planning (all global recipes)
SELECT r.*, c.title as collection_title, c.url_slug as collection_url_slug
FROM recipes r
INNER JOIN collections c ON r.collection_id = c.id
WHERE r.duplicate = 0
ORDER BY r.name ASC
```

#### Shopping List Generation
```sql
-- Generate shopping list from planned recipes
SELECT ri.*, i.name, i.fresh, i.cost
FROM plans p
JOIN recipe_ingredients ri ON p.recipe_id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE p.week = ? AND p.year = ?
```

## Week Calculation Logic

### ISO Week Number System

```typescript
// src/lib/queries/menus.ts - ISO week calculation
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Get current week
export function getCurrentWeek(): { week: number; year: number } {
  const now = new Date();
  return {
    week: getWeekNumber(now),
    year: now.getFullYear(),
  };
}

// Get next week (handles year boundary)
export function getNextWeek(): { week: number; year: number } {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    week: getWeekNumber(nextWeek),
    year: nextWeek.getFullYear(),
  };
}
```

#### Week Calculation Features
- **ISO 8601 Standard**: Monday-Sunday weeks, consistent year boundaries
- **Year Boundaries**: Week 1 contains January 4th, handles year transitions correctly
- **UTC Calculation**: Avoids timezone issues in week calculations
- **Week 53 Support**: Handles leap years and year boundary weeks

## API Architecture

### Core API Endpoints

#### Current Week Planning
```typescript
// GET /api/plan/current
// Returns current week's planned recipes
interface CurrentWeekResponse {
  week: number;
  year: number;
  recipes: Recipe[];
}
```

#### Week Plan Management
```typescript
// POST /api/plan/save
// Save recipes for specific week (replaces existing)
interface SaveWeekRequest {
  week: number;
  year: number;
  recipeIds: number[];
}

// DELETE /api/plan/delete  
// Delete entire week's plan
interface DeleteWeekRequest {
  week: number;
  year: number;
}
```

#### Recipe Randomization
```typescript
// GET /api/plan/randomize?count=3
// Smart recipe randomization with constraints
interface RandomizeResponse {
  recipes: Recipe[];
  totalAvailable: number;
}
```

#### Multi-Week Planning
```typescript
// GET /api/plan/week?week=X&year=Y
// Get specific week's recipes (currently uses next week logic)
interface WeekResponse {
  success: boolean;
  recipes: Recipe[];
  week: number;
  year: number;
}
```

### Authentication & Authorization
- **Authentication**: All endpoints protected with `withAuth()` middleware
- **No Authorization**: No permission checks - all authenticated users can modify any plan
- **Global State**: All users see and can modify the same meal plans

## Smart Recipe Randomization

### Algorithm Logic

```typescript
// src/app/api/plan/randomize/route.ts
function selectRandomRecipes(availableRecipes: Recipe[], count: number = 3): Recipe[] {
  const selected: Recipe[] = [];
  const usedPrimaryIngredients = new Set<string>();
  const usedSecondaryIngredients = new Set<string>();

  // Shuffle available recipes
  const shuffled = [...availableRecipes].sort(() => Math.random() - 0.5);

  for (const recipe of shuffled) {
    if (selected.length >= count) break;

    const ingredients = recipe.ingredients || [];
    if (ingredients.length === 0) continue;

    const primaryIngredient = ingredients[0];
    const secondaryIngredient = ingredients.length > 1 ? ingredients[1] : null;

    // Check for ingredient conflicts
    const primaryConflict = usedPrimaryIngredients.has(primaryIngredient);
    const secondaryConflict = secondaryIngredient && usedSecondaryIngredients.has(secondaryIngredient);

    if (!primaryConflict && !secondaryConflict) {
      selected.push(recipe);
      usedPrimaryIngredients.add(primaryIngredient);
      if (secondaryIngredient) {
        usedSecondaryIngredients.add(secondaryIngredient);
      }
    }
  }

  return selected;
}
```

### Randomization Features
- **Ingredient Conflict Avoidance**: No duplicate primary ingredients in same week
- **Secondary Ingredient Tracking**: Avoids secondary ingredient duplicates when possible
- **Recipe Pool Filtering**: Excludes recipes used in last 6 months
- **Flexible Count**: Configurable number of recipes (default 3)

### Recipe Pool Query
```sql
-- Get recipes available for randomization (exclude recent)
SELECT DISTINCT r.*, GROUP_CONCAT(DISTINCT i.name) as ingredients
FROM recipes r
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE r.duplicate = 0 
  AND r.id NOT IN (
    SELECT DISTINCT recipe_id 
    FROM plans 
    WHERE ((year = ? AND week >= ?) OR (year > ? AND year <= ?))
  )
GROUP BY r.id
ORDER BY r.name ASC
```

## Frontend Architecture

### State Management

#### Core Types
```typescript
// src/types/plan.ts
export interface PlanState {
  recipes: Recipe[];
  isEditMode: boolean;
  isLoading: boolean;
  week: number;
  year: number;
}

export interface WeekPlan {
  week: number;
  year: number;
  weekDates: string;  // "Jan 15 - Jan 21, 2024"
  recipes: Recipe[];
  initialRecipes: Recipe[];
  initialEditMode?: boolean;
}

export interface MultiWeekPlanState {
  weeks: WeekPlan[];
  allRecipes: Recipe[];
}
```

#### Context Architecture
```typescript
// src/app/plan/contexts/PlanProvider.tsx
export function PlanProvider({
  children,
  initialRecipes,
  allRecipes,
  week,
  year,
  weekDates,
  onRecipesChange,
  initialEditMode,
  onWeekDelete,
}: PlanProviderProps) {
  // State management hooks
  const { state, setRecipes, setEditMode, setLoading, resetToInitial } = usePlanState({
    initialRecipes, week, year, initialEditMode
  });
  
  const planActions = usePlanActions({...});
  const recipeActions = useRecipeManagement({...});
  
  return <PlanContext.Provider value={contextValue}>{children}</PlanContext.Provider>;
}
```

### Hook Architecture

#### Plan State Management
```typescript
// Specialized hooks for different aspects
usePlanState({
  initialRecipes, week, year, initialEditMode
}) // Core state (recipes, editMode, loading)

usePlanActions({
  recipes, setRecipes, setEditMode, setLoading, resetToInitial,
  week, year, setAnimatingAutomate, setPendingRecipes, onWeekDelete
}) // Plan CRUD operations

useRecipeManagement({
  recipes, setRecipes, setLoading
}) // Recipe manipulation within plans
```

### Service Layer
```typescript
// src/app/plan/services/planService.ts
class PlanService {
  async randomizeRecipes(count?: number): Promise<ApiResponse>
  async saveWeekPlan(week: number, year: number, recipeIds: number[]): Promise<ApiResponse>
  async deleteWeekPlan(week: number, year: number): Promise<ApiResponse>
  async resetShoppingList(week: number, year: number): Promise<ApiResponse>
}
```

## User Experience Flows

### Single Week Planning Flow

1. **Week Selection**: User navigates to plan page, sees current week by default
2. **Recipe Display**: Shows currently planned recipes for the week (if any)
3. **Edit Mode**: User clicks "Edit" to enter planning mode
4. **Recipe Selection**: 
   - Search/filter from all available recipes
   - Add recipes to the week
   - Remove existing recipes
   - Swap recipes with alternatives
5. **Randomization**: "Automate" button for smart recipe suggestions
6. **Save Changes**: Persist changes to database
7. **Shopping List**: Option to reset/regenerate shopping list from new plan

### Multi-Week Planning Flow

1. **Week Overview**: Shows current week and all planned future weeks
2. **Add Week**: "+ Add Week" creates new planning week (next available)
3. **Individual Week Management**: Each week has its own context and controls
4. **Week Deletion**: Remove entire week's plan with confirmation
5. **Bulk Operations**: Shopping list generation across multiple weeks

### Recipe Selection & Management

#### Recipe Search & Filter
```typescript
// Recipe selection from global pool
interface RecipeFilterOptions {
  searchTerm: string;
  excludeIds: number[];     // Don't show already selected recipes
  maxResults?: number;
}

// Search across recipe names, descriptions, ingredients
const filteredRecipes = allRecipes.filter(recipe => {
  const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
  const notExcluded = !excludeIds.includes(recipe.id);
  return matchesSearch && notExcluded;
});
```

#### Recipe Actions
- **Add Recipe**: Add recipe to current week's plan
- **Remove Recipe**: Remove recipe from current week's plan
- **Swap Recipe**: Replace existing recipe with alternative
- **Add Random**: Add single random recipe with constraint checking

## Shopping List Integration

### Auto-Generation from Plans
```sql
-- Reset shopping list from planned recipes
DELETE FROM shopping_lists WHERE week = ? AND year = ?;

-- Generate shopping list with ingredient aggregation
INSERT INTO shopping_lists (week, year, fresh, name, sort, cost, recipeIngredient_id, purchased, stockcode)
SELECT 
  ?, ?, 
  i.fresh,
  i.name,
  ROW_NUMBER() OVER (ORDER BY i.fresh DESC, i.name) as sort,
  i.cost,
  ri.id,
  0 as purchased,
  i.stockcode
FROM plans p
JOIN recipe_ingredients ri ON p.recipe_id = ri.recipe_id  
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE p.week = ? AND p.year = ?
```

### Shopping List Features
- **Automatic Generation**: Create shopping list from meal plan recipes
- **Ingredient Aggregation**: Combine duplicate ingredients by name + measurement
- **Fresh/Pantry Separation**: Split by ingredient.fresh flag
- **Cost Estimation**: Include ingredient costs where available
- **Source Tracking**: Link back to original recipe ingredients

## Performance Characteristics

### Query Performance
- **Week-Based Indexing**: Queries typically filter by (week, year)
- **Recipe Joins**: Most queries join plans → recipes → collections
- **Shopping Generation**: Complex multi-table joins for shopping list creation
- **Global Scope**: All queries scan full database (no household scoping)

### Memory Usage
- **Recipe Loading**: getAllRecipesWithDetails loads all recipes with ingredients
- **Multi-Week State**: Holds multiple weeks of recipes in memory
- **Context Providers**: Nested contexts for complex state management

### Database Load
- **Read-Heavy**: Meal planning is primarily reading existing data
- **Batch Writes**: Week saves replace entire week's recipes in transaction
- **Shopping Integration**: Shopping list reset triggers complex regeneration

## Current Limitations & Technical Debt

### Data Isolation Issues
1. **Global Plans**: All users share the same meal plans
2. **Concurrent Editing**: No conflict resolution between simultaneous users
3. **No Ownership**: Cannot track who created which plans

### Performance Considerations
1. **Global Recipe Loading**: Loads all recipes regardless of user access
2. **Complex Shopping Generation**: Expensive multi-table joins
3. **No Pagination**: Recipe selection shows all recipes at once

### User Experience Limitations
1. **Shared State**: Changes by one user affect all users
2. **No Personal History**: Cannot track individual planning patterns
3. **Limited Customization**: No user-specific preferences

## Integration Points for Household System

### Database Changes Required
```sql
-- Add household scoping to plans table
ALTER TABLE plans ADD COLUMN household_id INT NOT NULL;
ALTER TABLE plans ADD FOREIGN KEY (household_id) REFERENCES households(id);
ALTER TABLE plans ADD INDEX idx_household_week_year (household_id, week, year);
```

### Query Updates Required
1. **Recipe Selection**: Filter by household-accessible recipes
2. **Plan CRUD**: Scope all operations by user's household_id
3. **Shopping Generation**: Generate per-household shopping lists
4. **Week Planning**: Show household-specific planned weeks

### API Changes Required
1. **Authentication Context**: Extract household_id from user session
2. **Permission Checks**: Verify user can access/modify household plans
3. **Data Scoping**: Add household_id to all plan operations

### Frontend Updates Required
1. **Recipe Filtering**: Show only household-accessible recipes
2. **Plan Isolation**: Display household-specific meal plans
3. **Shopping Integration**: Household-scoped shopping list generation

## System Strengths to Preserve

### Architecture Strengths
1. **Clean Separation**: Clear separation between data, API, and UI layers
2. **Type Safety**: Comprehensive TypeScript interfaces throughout
3. **Hook Architecture**: Well-structured React hooks for state management
4. **Service Layer**: Clean abstraction for API interactions

### User Experience Strengths
1. **Intuitive Planning**: Week-based planning matches user mental models
2. **Smart Randomization**: Intelligent recipe suggestions with constraints
3. **Multi-Week Support**: Plan ahead capability with individual week management
4. **Shopping Integration**: Seamless connection to shopping list generation

### Technical Strengths
1. **ISO Week Logic**: Robust week calculation handling edge cases
2. **Transaction Safety**: Proper database transactions for data consistency
3. **Error Handling**: Comprehensive error handling throughout the stack
4. **Authentication**: Proper API protection with authentication middleware

This meal planning system provides a solid foundation for household-scoped planning while maintaining the intuitive user experience and robust technical architecture.