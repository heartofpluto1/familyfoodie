# Shopping List System Specification

## Executive Summary

This document captures the current shopping list system architecture in the FamilyFoodie application. The system provides intelligent shopping list generation from meal plans, manual item management, purchase tracking, and sophisticated user interface features including drag-and-drop organization. This specification serves as a foundation reference before implementing household-scoped shopping lists.

## Current System Overview

### Core Concepts
- **Week-Based Lists**: Shopping lists tied to specific week/year periods
- **Fresh/Pantry Organization**: Items categorized by ingredient freshness type
- **Auto-Generation**: Lists automatically created from meal plan recipes
- **Manual Management**: Users can add, remove, and modify items
- **Purchase Tracking**: Items can be marked as purchased during shopping
- **Global Lists**: All shopping lists shared across users (no household isolation)

### Business Logic
- **Meal Plan Integration**: Shopping lists derive from planned recipes
- **Ingredient Aggregation**: Duplicate ingredients combined by name + measurement
- **Sort Order Management**: Complex sorting within fresh/pantry categories
- **Cost Calculation**: Automatic cost totaling from ingredient data
- **Dual Item Types**: Recipe-generated items vs manual text items

## Database Architecture

### Core Table: `shopping_lists`

```sql
CREATE TABLE shopping_lists (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  week SMALLINT NOT NULL,
  year SMALLINT NOT NULL,
  fresh TINYINT(1) NOT NULL,           -- 1=fresh, 0=pantry
  name VARCHAR(40) NOT NULL,           -- ingredient/item name
  sort SMALLINT NOT NULL,              -- sort order within category
  cost DOUBLE DEFAULT NULL,            -- item cost
  stockcode INT DEFAULT NULL,          -- store inventory code
  purchased TINYINT(1) NOT NULL,       -- purchase status
  recipeIngredient_id INT DEFAULT NULL, -- FK to recipe_ingredients (optional)
  FOREIGN KEY (recipeIngredient_id) REFERENCES recipe_ingredients(id)
);
```

#### Table Characteristics
- **Week Scoping**: (week, year) identifies shopping list period
- **Category Split**: `fresh` flag separates produce from pantry items
- **Sort Management**: `sort` provides ordering within each category
- **Optional Recipe Link**: `recipeIngredient_id` links auto-generated items back to source
- **Text Items Support**: NULL `recipeIngredient_id` for manually added items
- **Purchase State**: `purchased` tracks completion status

#### Current Data Access Patterns
```sql
-- Get week's shopping list (fresh items)
SELECT sl.*, ri.quantity, ri.quantity4, m.name as quantityMeasure,
       i.name as ingredient_name, sc.name as supermarketCategory
FROM shopping_lists sl
LEFT JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
LEFT JOIN measurements m ON ri.quantityMeasure_id = m.id
LEFT JOIN category_supermarket sc ON i.supermarketCategory_id = sc.id
WHERE sl.week = ? AND sl.year = ? AND sl.fresh = 1
ORDER BY sl.sort, sl.id

-- Get week's shopping list (pantry items)
SELECT sl.*, ri.quantity, ri.quantity4, m.name as quantityMeasure,
       i.name as ingredient_name, pc.name as pantryCategory
FROM shopping_lists sl
LEFT JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
LEFT JOIN measurements m ON ri.quantityMeasure_id = m.id
LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
WHERE sl.week = ? AND sl.year = ? AND sl.fresh = 0
ORDER BY sl.sort, sl.id
```

## Shopping List Generation Algorithm

### Auto-Generation from Meal Plans

```sql
-- Complex ingredient aggregation logic in resetShoppingListFromRecipes()
DELETE FROM shopping_lists WHERE week = ? AND year = ?;

-- Get all ingredients from planned recipes
SELECT 
  ri.id as recipeIngredient_id,
  ri.ingredient_id,
  ri.quantity,
  ri.quantity4,
  ri.quantityMeasure_id,
  i.name as ingredient_name,
  i.pantryCategory_id,
  i.supermarketCategory_id,
  i.fresh,
  i.cost,
  i.stockcode,
  m.name as measure_name
FROM plans rw
JOIN recipe_ingredients ri ON rw.recipe_id = ri.recipe_id
JOIN recipes r ON rw.recipe_id = r.id
JOIN ingredients i ON ri.ingredient_id = i.id
LEFT JOIN measurements m ON ri.quantityMeasure_id = m.id
WHERE rw.week = ? AND rw.year = ?
ORDER BY 
  CASE 
    WHEN i.fresh = 1 THEN i.supermarketCategory_id
    WHEN i.fresh = 0 THEN i.pantryCategory_id
    ELSE 999
  END,
  i.name
```

### Ingredient Aggregation Logic

```typescript
// Complex grouping logic from resetShoppingListFromRecipes()
const groupedIngredients = ingredients.reduce((acc, ingredient) => {
  // Create composite key from ingredient_id and quantityMeasure_id
  const key = `${ingredient.ingredient_id}-${ingredient.quantityMeasure_id || 'null'}`;
  
  if (!acc[key]) {
    acc[key] = {
      recipeIngredient_id: ingredient.recipeIngredient_id,
      ingredient_id: ingredient.ingredient_id,
      ingredient_name: ingredient.ingredient_name,
      quantity: 0,
      quantity4: 0,
      quantityMeasure_id: ingredient.quantityMeasure_id,
      // ... other properties
    };
  }
  
  // Aggregate quantities
  acc[key].quantity += parseFloat(ingredient.quantity || '0');
  acc[key].quantity4 += parseFloat(ingredient.quantity4 || '0');
  
  return acc;
}, {});
```

### Generation Features
- **Duplicate Prevention**: Same ingredient + measurement = single list item
- **Quantity Aggregation**: Multiple recipes using same ingredient combine quantities
- **Category Sorting**: Items sorted by supermarket/pantry category, then name
- **Cost Inheritance**: Item costs pulled from ingredients table
- **Stockcode Preservation**: Store inventory codes maintained for known ingredients

## API Architecture

### Core API Endpoints

**Note**: Shopping list data is fetched server-side using direct database queries via `getShoppingList()` and `getIngredients()` functions.

#### List Management
```typescript
// POST /api/shop/reset
// Regenerate shopping list from meal plan
interface ResetListRequest {
  week: number;
  year: number;
}

// PUT /api/shop/add
// Add new item (known ingredient or text)
interface AddItemRequest {
  week: number;
  year: number;
  name: string;
  ingredient_id?: number | null;
}

// DELETE /api/shop/remove
// Remove item from list
interface RemoveItemRequest {
  id: number;
}
```

#### Item State Management
```typescript
// POST /api/shop/purchase
// Toggle item purchase status
interface PurchaseRequest {
  id: number;
  purchased: boolean;
}

// PUT /api/shop/move
// Move item between fresh/pantry with sort management
interface MoveItemRequest {
  id: number;
  fresh: number;      // 1=fresh, 0=pantry
  sort: number;       // new position
  week: number;
  year: number;
}
```

### Complex Sort Management

#### Move Item Algorithm
```typescript
// Complex sort reordering logic from /api/shop/move
async function moveItem(id: number, fresh: number, sort: number, week: number, year: number) {
  await connection.beginTransaction();
  
  // Update the moved item
  await connection.execute(
    'UPDATE shopping_lists SET fresh = ?, sort = ? WHERE id = ? AND week = ? AND year = ?',
    [fresh, sort, id, week, year]
  );
  
  // Get all other items in target category
  const [items] = await connection.execute(
    'SELECT id, sort FROM shopping_lists WHERE fresh = ? AND week = ? AND year = ? AND id != ? ORDER BY sort ASC',
    [fresh, week, year, id]
  );
  
  // Recalculate sort values for affected items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let newSort = i;
    
    // If moved item should be inserted before this position, increment
    if (i >= sort) {
      newSort = i + 1;
    }
    
    if (item.sort !== newSort) {
      await connection.execute('UPDATE shopping_lists SET sort = ? WHERE id = ?', [newSort, item.id]);
    }
  }
  
  await connection.commit();
}
```

### Authentication & Authorization
- **Authentication**: All endpoints protected with `withAuth()` middleware
- **No Authorization**: No permission checks - all authenticated users can modify any shopping list
- **Global State**: All users see and can modify the same shopping lists

## Frontend Architecture

### State Management

#### Core Types
```typescript
// src/types/shop.ts
export interface ListItem {
  id: number;
  ingredient: string;
  name: string;
  cost?: number;
  stockcode?: number;
  purchased?: boolean;
  sort: number;
  quantity?: string;
  quantityMeasure?: string;
  ingredientId?: number;
  supermarketCategory?: string;
  pantryCategory?: string;
  fresh: boolean;
  isPurchasable?: boolean;
  dragover?: boolean;
}

export interface ShoppingListData {
  fresh: ListItem[];
  pantry: ListItem[];
}

export interface DateStamp {
  week: number;
  year: number;
}
```

#### Context Architecture
```typescript
// src/app/shop/contexts/ShoppingListContext.tsx
export function ShoppingListProvider({
  children,
  initialData,
  datestamp,
  allIngredients
}: ShoppingListProviderProps) {
  const shoppingList = useShoppingList(initialData, datestamp);
  const dndKit = useDndKit(shoppingList.ingredients, shoppingList.setIngredients, datestamp);
  const addItemHook = useAddItem(allIngredients);
  
  // Complex state management combining multiple hooks
  return <ShoppingListContext.Provider value={contextValue}>{children}</ShoppingListContext.Provider>;
}
```

### Hook Architecture

#### Specialized Hooks
```typescript
// Shopping list CRUD operations
useShoppingList(initialData, datestamp) // Core list state and operations

// Drag and drop functionality  
useDndKit(ingredients, setIngredients, datestamp) // dnd-kit integration

// Item addition with autocomplete
useAddItem(allIngredients) // Ingredient search and selection
```

### Service Layer
```typescript
// src/app/shop/services/shoppingListService.ts
export class ShoppingListService {
  static async addItem(week: number, year: number, name: string, ingredientId?: number | null)
  static async removeItem(id: number)
  static async moveItem(id: number, fresh: number, sort: number, week: number, year: number)
  static async togglePurchase(id: number, purchased: boolean)
  static async resetList(week: number, year: number)
}
```

## Advanced User Interface Features

### Drag and Drop System

#### dnd-kit Integration
```typescript
// Sophisticated drag and drop with @dnd-kit/core
interface DndKitHandlers {
  sensors: SensorDescriptor<SensorOptions>[];
  activeId: UniqueIdentifier | null;
  overId: UniqueIdentifier | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}
```

#### Drag and Drop Features
- **Cross-Category Movement**: Drag items between fresh and pantry sections
- **Sort Order Management**: Automatic reordering with sort value recalculation
- **Visual Feedback**: Active dragging indicators and drop zones
- **Touch Support**: Mobile-friendly drag interactions
- **Conflict Prevention**: Transaction-based sort updates prevent race conditions

### Item Addition System

#### Ingredient Autocomplete
```typescript
// Smart ingredient matching from allIngredients
const matchedIngredients = allIngredients.filter(ingredient =>
  ingredient.name.toLowerCase().includes(searchTerm.toLowerCase())
);

// Support for both known ingredients and free text
const addItem = async (name: string, ingredientId?: number | null) => {
  if (ingredientId) {
    // Add known ingredient with cost, stockcode, etc.
    await ShoppingListService.addItem(week, year, name, ingredientId);
  } else {
    // Add free text item
    await ShoppingListService.addItem(week, year, name, null);
  }
};
```

#### Addition Features
- **Ingredient Search**: Type-ahead search through known ingredients database
- **Free Text Support**: Add custom items not in ingredients database
- **Cost Inheritance**: Known ingredients automatically get cost and stockcode
- **Category Assignment**: Items placed in appropriate fresh/pantry category
- **Sort Positioning**: New items added at end of appropriate category

### Cost Calculation System

```typescript
// Automatic cost calculation across all items
const totalCost = [...ingredients.fresh, ...ingredients.pantry]
  .filter(item => !item.purchased && item.cost)
  .reduce((sum, item) => sum + (item.cost || 0), 0);
```

## User Experience Flows

### Shopping List Generation Flow

1. **Meal Plan Integration**: User has planned recipes for specific week
2. **List Reset**: User clicks "Reset from meal plan" button
3. **Confirmation Dialog**: System shows confirmation before replacing existing list
4. **Generation Process**: 
   - Delete existing shopping list items for week
   - Query all ingredients from planned recipes
   - Group ingredients by ingredient_id + quantityMeasure_id
   - Aggregate quantities for duplicate ingredients
   - Create shopping list items with inherited costs/stockcodes
5. **Category Organization**: Items sorted by fresh/pantry, then by category, then by name
6. **User Review**: Generated list displayed for user modification

### Manual Shopping List Management Flow

1. **Week Selection**: User navigates to specific week's shopping list
2. **List Display**: Shows fresh and pantry items with purchase status
3. **Item Addition**:
   - Type item name in input field
   - System provides autocomplete from ingredients database
   - Select known ingredient OR enter free text
   - Item added to appropriate category with proper sorting
4. **Item Organization**:
   - Drag items between fresh/pantry sections
   - Reorder items within sections
   - System automatically recalculates sort values
5. **Purchase Tracking**:
   - Check off items during shopping
   - Purchased items remain visible but marked
   - Cost calculation excludes purchased items
6. **Item Removal**: Delete individual items with confirmation

### Shopping Experience Flow

1. **Mobile Optimization**: Interface designed for smartphone use during shopping
2. **Category Navigation**: Clear fresh/pantry section headers
3. **Purchase Checking**: Large checkboxes for easy tapping
4. **Cost Tracking**: Running total of remaining unpurchased items
5. **Item Details**: Quantities, measurements, and stockcodes displayed
6. **Completion Status**: Visual progress indication as items are purchased

## Integration Points

### Meal Planning Integration

#### Recipe Ingredient Extraction
```sql
-- Get ingredients for shopping list generation
SELECT ri.*, i.name, i.fresh, i.cost, i.stockcode
FROM recipe_ingredients ri
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE ri.recipe_id IN (
  SELECT recipe_id FROM plans WHERE week = ? AND year = ?
)
```

#### Shopping List Reset Triggers
- **Manual Reset**: User-initiated reset from meal plan
- **Plan Changes**: Optional automatic reset when meal plan changes
- **Week Planning**: Generate list when meal plan is first created

### Ingredient Database Integration

#### Known Ingredient Benefits
```typescript
// Known ingredients provide rich data
interface KnownIngredient {
  id: number;
  name: string;
  cost?: number;              // Automatic cost calculation
  stockcode?: number;         // Store inventory code
  fresh: boolean;             // Category assignment
  supermarketCategory_id: number; // Aisle organization
  pantryCategory_id: number;  // Pantry organization
}

// Free text items are minimal
interface TextOnlyItem {
  name: string;
  cost: null;
  stockcode: null;
  fresh: true; // Default to fresh section
}
```

## Performance Characteristics

### Query Performance
- **Week Scoping**: All queries filter by (week, year) for efficient access
- **Category Splits**: Separate fresh/pantry queries reduce result set sizes
- **Sort Optimization**: Sort operations within small category groups
- **Join Complexity**: Shopping list queries join 4-5 tables for rich data

### Memory Usage
- **Ingredient Loading**: All ingredients loaded for autocomplete functionality
- **List Caching**: Shopping list data cached in React context
- **Drag State**: dnd-kit maintains complex drag/drop state

### Database Load
- **Read-Heavy**: Shopping lists primarily read existing data
- **Sort Updates**: Move operations trigger multiple UPDATE statements
- **Reset Operations**: List reset deletes/inserts all items in transaction

## Current Limitations & Technical Debt

### Data Isolation Issues
1. **Global Lists**: All users share the same shopping lists
2. **Concurrent Editing**: No conflict resolution between simultaneous users
3. **No Ownership**: Cannot track who created or modified items

### Performance Considerations
1. **Sort Management**: Complex sort reordering with multiple database updates
2. **Ingredient Loading**: Loads all ingredients for autocomplete regardless of relevance
3. **No Pagination**: Shopping lists load all items regardless of size

### User Experience Limitations
1. **Shared State**: Changes by one user affect all users
2. **No Personal Preferences**: Cannot customize category organization
3. **Limited History**: No tracking of shopping patterns or preferences

## Integration Points for Household System

### Database Changes Required
```sql
-- Add household scoping to shopping_lists table
ALTER TABLE shopping_lists ADD COLUMN household_id INT NOT NULL;
ALTER TABLE shopping_lists ADD FOREIGN KEY (household_id) REFERENCES households(id);
ALTER TABLE shopping_lists ADD INDEX idx_household_week_year (household_id, week, year);
```

### Query Updates Required
1. **List Retrieval**: Filter by household_id in all shopping list queries
2. **Item CRUD**: Scope all operations by user's household_id
3. **Ingredient Access**: Filter ingredients by household-accessible items
4. **Reset Generation**: Generate lists from household-specific meal plans

### API Changes Required
1. **Authentication Context**: Extract household_id from user session
2. **Permission Checks**: Verify user can access/modify household shopping lists
3. **Data Scoping**: Add household_id to all shopping list operations
4. **Ingredient Filtering**: Limit autocomplete to household-accessible ingredients

### Frontend Updates Required
1. **Ingredient Autocomplete**: Show only household-accessible ingredients
2. **List Isolation**: Display household-specific shopping lists
3. **Cost Calculations**: Household-scoped cost totaling

## System Strengths to Preserve

### Architecture Strengths
1. **Flexible Item Types**: Support for both recipe-generated and manual items
2. **Rich Data Model**: Comprehensive ingredient data with costs and categories
3. **Transaction Safety**: Proper database transactions for complex operations
4. **Clean Separation**: Clear separation between data, API, and UI layers

### User Experience Strengths
1. **Intuitive Organization**: Fresh/pantry split matches shopping behavior
2. **Sophisticated Drag & Drop**: Professional-grade user interaction
3. **Smart Autocomplete**: Helpful ingredient suggestions during item addition
4. **Purchase Tracking**: Practical completion tracking during shopping
5. **Cost Awareness**: Automatic cost calculation helps budget planning

### Technical Strengths
1. **Sort Management**: Robust sort order handling for complex reordering
2. **Ingredient Aggregation**: Intelligent duplicate prevention and quantity combining
3. **Mobile Optimization**: Touch-friendly interface for smartphone shopping
4. **Error Handling**: Comprehensive error handling throughout the stack

This shopping list system provides excellent user experience and robust technical foundations for household-scoped shopping while maintaining the sophisticated features users expect from a modern shopping app.