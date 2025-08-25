# Issue 007: Remove Redundant supermarketCategory_id from shopping_lists Table

## Problem Description

### Current State
The `shopping_lists` table contains a `supermarketCategory_id` column that duplicates data already available in the `ingredients` table. This creates data redundancy and potential consistency issues.

### Current Schema
```sql
-- shopping_lists table
shopping_lists.supermarketCategory_id -> category_supermarket.id (FK)

-- ingredients table  
ingredients.supermarketCategory_id -> category_supermarket.id (FK)

-- Relationship
shopping_lists.recipeIngredient_id -> recipe_ingredients.id
recipe_ingredients.ingredient_id -> ingredients.id
```

### The Redundancy Problem
1. **Data Duplication**: When creating shopping list entries, `supermarketCategory_id` is copied from `ingredients.supermarketCategory_id`
2. **Consistency Risk**: Same data stored in two places can lead to synchronization issues
3. **Unnecessary Storage**: Column stores derived data that can be obtained through joins
4. **Limited Value**: Only used for display purposes in queries, never updated independently

### Code Analysis

#### Data Population (`src/lib/queries/menus.ts:507-514`)
```typescript
// Currently copies supermarketCategory_id from ingredients
await connection.execute(
    `INSERT INTO shopping_lists (..., supermarketCategory_id) VALUES (..., ?)`,
    [..., ingredient.supermarketCategory_id]
);
```

#### Manual Item Addition (`src/app/api/shop/add/route.ts:69`)
```typescript
// Copies from ingredients table when known ingredient
INSERT INTO shopping_lists (..., supermarketCategory_id) 
VALUES (..., knownIngredient.supermarketCategory_id)

// Sets to NULL for unknown/custom items
INSERT INTO shopping_lists (..., supermarketCategory_id) 
VALUES (..., NULL)
```

#### Query Usage (`src/lib/queries/shop.ts:94,122`)
```sql
-- Currently uses direct column
SELECT 
    sl.supermarketCategory_id,
    sc.name as supermarketCategory
FROM shopping_lists sl
LEFT JOIN category_supermarket sc ON sl.supermarketCategory_id = sc.id
```

## Proposed Solution

### Remove Redundant Column
Eliminate `shopping_lists.supermarketCategory_id` and obtain category data through proper joins to the ingredients table.

### Updated Query Pattern
```sql
-- New approach: Get category through ingredients join
SELECT 
    sl.id,
    sl.name,
    i.supermarketCategory_id,
    sc.name as supermarketCategory
FROM shopping_lists sl
LEFT JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
LEFT JOIN category_supermarket sc ON i.supermarketCategory_id = sc.id
```

**Note**: Follow existing join patterns already established in the codebase for `pantryCategory` which uses the exact same approach: `shopping_lists → recipe_ingredients → ingredients → category_pantry`

### Database Migration
```sql
-- Migration: Remove redundant column
ALTER TABLE shopping_lists DROP COLUMN supermarketCategory_id;

-- Remove foreign key constraint first if needed
ALTER TABLE shopping_lists DROP FOREIGN KEY menus_shoppinglist_supermarketCategory__4f049627_fk_menus_sup;
```

## Implementation Areas

### 1. Database Migration
- Create migration script to drop the column
- Remove foreign key constraint

### 2. Query Updates
- `src/lib/queries/shop.ts` - Update `getShoppingList()` to join through ingredients
- `src/lib/queries/menus.ts` - Remove `supermarketCategory_id` from INSERT statements

### 3. API Route Updates  
- `src/app/api/shop/add/route.ts` - Remove `supermarketCategory_id` from INSERT
- Any other routes that reference this column

### 4. Type Definitions
- Update TypeScript interfaces if they reference `supermarketCategory_id` directly
- Ensure types reflect new data structure

## Benefits

### Data Integrity
- **Single Source of Truth**: Category data only stored in ingredients table
- **Consistency**: No risk of mismatched data between tables
- **Referential Integrity**: Category always reflects current ingredient data

### Maintenance
- **Simpler Updates**: Category changes only need updating in one place
- **Cleaner Schema**: Follows database normalization principles
- **Reduced Complexity**: Fewer columns to maintain

### Performance Considerations
- **Minimal Impact**: Join to ingredients table already exists for other fields
- **Existing Pattern**: Follows same approach as `pantryCategory` lookups
- **Index Usage**: Can leverage existing indexes on join columns

## Testing Requirements

**Important Note**: Do NOT write new tests for this refactoring work. Only fix any existing tests that break due to the schema changes.

### Areas to Verify
1. Shopping list display shows correct categories
2. Manual item addition still works (NULL category for custom items)
3. Recipe-based shopping list generation maintains categories
4. All existing shopping list features continue working

## Risk Assessment

### Low Risk
- Well-defined change scope
- Following existing patterns (pantryCategory approach)
- Non-breaking for API consumers (same response structure)

### Medium Risk
- Multiple query updates required
- Need to ensure all references are found and updated

### Mitigation Strategies
- Comprehensive grep search for all `supermarketCategory_id` references
- Test shopping list functionality thoroughly
- Review all modified queries for correctness

## Success Criteria

1. `shopping_lists` table no longer has `supermarketCategory_id` column
2. All shopping list queries return correct category data through joins
3. No functionality regression in shopping list features
4. Custom/unknown items still handled correctly (NULL category)
5. All existing tests pass after fixes

## Related Issues

- Database normalization improvements

## Notes

- This change aligns with database normalization best practices (3NF)
- Reduces technical debt by eliminating redundancy
- Makes future household feature implementation cleaner