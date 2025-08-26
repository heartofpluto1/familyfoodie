# Current System Architecture Specification

## Executive Summary

This document captures the existing architecture of the FamilyFoodie application before implementing the household feature system. This serves as the foundational reference for understanding what will be modified during the household implementation. The current system is a single-tenant application where all users share access to all data without isolation.

## System Overview

### Technology Stack
- **Framework**: Next.js 15 with App Router pattern
- **Language**: TypeScript
- **Database**: MySQL 8.0.x with connection pooling via mysql2/promise
- **Authentication**: Django-compatible PBKDF2 password hashing with session management
- **Styling**: Tailwind CSS v4

### Current Tenancy Model
- **Single-tenant**: All users share access to all data
- **No Data Isolation**: Users can see and modify all collections, recipes, and ingredients
- **Global State**: Meal plans and shopping lists are global (not user-specific)
- **Authentication**: Exists but provides no data boundaries between users

## Database Architecture

### Core Tables Schema

```sql
-- User management
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(150) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL,
  password VARCHAR(128) NOT NULL,  -- PBKDF2 Django-compatible
  first_name VARCHAR(30) NOT NULL,
  last_name VARCHAR(150) NOT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL,
  date_joined DATETIME NOT NULL,
  last_login DATETIME DEFAULT NULL
);

-- Collections (recipe groupings)
CREATE TABLE collections (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  filename VARCHAR(255) DEFAULT 'custom_collection_004',
  filename_dark VARCHAR(255) DEFAULT 'custom_collection_004_dark',
  url_slug VARCHAR(255) NOT NULL DEFAULT '1-initial',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Recipes (main content)
CREATE TABLE recipes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  description LONGTEXT,
  prepTime SMALLINT DEFAULT NULL,
  cookTime SMALLINT NOT NULL,
  collection_id INT DEFAULT NULL,  -- FK to collections
  season_id INT DEFAULT NULL,
  primaryType_id INT DEFAULT NULL,
  secondaryType_id INT DEFAULT NULL,
  duplicate TINYINT(1) NOT NULL,
  public TINYINT(1) NOT NULL,
  url_slug VARCHAR(255) NOT NULL,
  image_filename VARCHAR(100) DEFAULT NULL,
  pdf_filename VARCHAR(100) DEFAULT NULL,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Ingredients (recipe components)
CREATE TABLE ingredients (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  fresh TINYINT(1) NOT NULL,
  public TINYINT(1) NOT NULL,
  cost DOUBLE DEFAULT NULL,
  stockcode INT DEFAULT NULL,
  supermarketCategory_id INT NOT NULL,
  pantryCategory_id INT NOT NULL,
  FOREIGN KEY (supermarketCategory_id) REFERENCES category_supermarket(id),
  FOREIGN KEY (pantryCategory_id) REFERENCES category_pantry(id)
);

-- Recipe-Ingredient relationships (many-to-many)
CREATE TABLE recipe_ingredients (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity VARCHAR(16) NOT NULL,
  quantity4 VARCHAR(16) NOT NULL,  -- 4-person serving quantity
  quantityMeasure_id INT DEFAULT NULL,
  preperation_id INT DEFAULT NULL,
  primaryIngredient TINYINT(1) NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  FOREIGN KEY (quantityMeasure_id) REFERENCES measurements(id),
  FOREIGN KEY (preperation_id) REFERENCES preparations(id)
);

-- Meal planning (weekly)
CREATE TABLE plans (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  week SMALLINT NOT NULL,
  year SMALLINT NOT NULL,
  recipe_id INT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id)
);

-- Shopping lists (generated from meal plans)
CREATE TABLE shopping_lists (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  week SMALLINT NOT NULL,
  year SMALLINT NOT NULL,
  fresh TINYINT(1) NOT NULL,  -- 1=fresh, 0=pantry
  name VARCHAR(40) NOT NULL,  -- ingredient name
  sort SMALLINT NOT NULL,     -- sort order
  cost DOUBLE DEFAULT NULL,
  stockcode INT DEFAULT NULL,
  purchased TINYINT(1) NOT NULL,
  recipeIngredient_id INT DEFAULT NULL,  -- links back to recipe_ingredients
  FOREIGN KEY (recipeIngredient_id) REFERENCES recipe_ingredients(id)
);
```

### Supporting Tables
```sql
-- Category and classification tables
CREATE TABLE category_supermarket (id INT PRIMARY KEY, name VARCHAR(20) NOT NULL);
CREATE TABLE category_pantry (id INT PRIMARY KEY, name VARCHAR(20) NOT NULL);
CREATE TABLE measurements (id INT PRIMARY KEY, name VARCHAR(20) NOT NULL);
CREATE TABLE preparations (id INT PRIMARY KEY, name VARCHAR(20) NOT NULL);
CREATE TABLE seasons (id INT PRIMARY KEY, name VARCHAR(20) NOT NULL);
CREATE TABLE type_proteins (id INT PRIMARY KEY, name VARCHAR(120) NOT NULL);
CREATE TABLE type_carbs (id INT PRIMARY KEY, name VARCHAR(120) NOT NULL);

-- Migration tracking
CREATE TABLE schema_migrations (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INT DEFAULT NULL
);
```

### Key Relationships
1. **Collections → Recipes**: One-to-many via `recipes.collection_id`
2. **Recipes → Ingredients**: Many-to-many via `recipe_ingredients` junction table
3. **Plans → Recipes**: Many-to-one for weekly meal planning
4. **Shopping Lists → Recipe Ingredients**: Optional link back to source recipe ingredient
5. **Users**: Standalone table with no foreign key relationships to data

### Current Data Access Patterns
- **Global Access**: All users can access all collections, recipes, ingredients
- **No Ownership**: No concept of who owns or created what
- **Shared State**: Meal plans and shopping lists are global (not user-specific)
- **No Isolation**: Changes by one user affect all users

## Application Architecture

### Authentication System

#### Current Authentication Flow
```typescript
// src/lib/auth.ts equivalent functionality
interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

// Session-based authentication with signed cookies
// Django-compatible PBKDF2 password verification
// withAuth() HOC wraps all API endpoints
// requireAdminUser() for admin-only endpoints
```

#### Authentication Middleware
- **API Protection**: All `/api/*` endpoints wrapped with `withAuth()` HOC
- **Admin Protection**: All `/api/admin/*` endpoints use `requireAdminUser()`
- **Session Management**: Uses signed cookies for session persistence
- **Password Hashing**: Django-compatible PBKDF2_SHA256 algorithm

### Query Layer Architecture

#### Core Query Functions

```typescript
// src/lib/queries/collections.ts
export async function getAllCollections(): Promise<Collection[]>
export async function getCollectionById(id: number): Promise<Collection | null>
export async function getCollectionsForDisplay(): Promise<Collection[]>

// src/lib/queries/menus.ts (recipes & meal planning)
export async function getAllRecipes(collectionId?: number): Promise<Recipe[]>
export async function getAllRecipesWithDetails(collectionId?: number): Promise<Recipe[]>
export async function getRecipeDetails(id: string): Promise<RecipeDetail | null>
export async function getCurrentWeekRecipes(): Promise<Recipe[]>
export async function getNextWeekRecipes(): Promise<Recipe[]>
export async function saveWeekRecipes(week: number, year: number, recipeIds: number[]): Promise<void>
export async function resetShoppingListFromRecipes(week: number, year: number): Promise<void>

// src/lib/queries/shop.ts (shopping & ingredients)
export async function getIngredients(): Promise<Ingredient[]>  // public=1 only
export async function getAllIngredients(): Promise<Ingredient[]>  // public=1 only
export async function getShoppingList(week: string, year: string): Promise<ShoppingListData>
```

#### Query Characteristics
- **Global Scope**: All queries return global data across all users
- **No User Filtering**: No household_id or user_id filtering in any queries
- **Public Flag**: Ingredients have `public=1` filter (legacy from multi-tenant attempt)
- **Collection Filtering**: Optional filtering by collection_id in recipe queries

### API Architecture

#### Authentication Layer
```typescript
// All API endpoints protected with withAuth() HOC
// Admin endpoints additionally protected with requireAdminUser()

// Example protected endpoint structure:
export async function GET(request: NextRequest) {
  // withAuth() automatically validates session and provides user context
  // User is authenticated but data access is still global
}
```

#### Core API Endpoints

**Meal Planning APIs:**
- `GET /api/plan/current` - Get current week's planned recipes
- `GET /api/plan/week` - Get specific week's planned recipes  
- `POST /api/plan/save` - Save recipes for a specific week
- `DELETE /api/plan/delete` - Delete specific week's plan
- `POST /api/plan/randomize` - Generate random meal plan

**Shopping List APIs:**
- `GET /api/shop` - Get shopping list for specific week/year
- `POST /api/shop/reset` - Regenerate shopping list from meal plan
- `POST /api/shop/add` - Add custom item to shopping list
- `POST /api/shop/purchase` - Mark item as purchased
- `POST /api/shop/move` - Move item between fresh/pantry sections
- `DELETE /api/shop/remove` - Remove item from shopping list

**Recipe Management APIs:**
- `GET /api/recipe/options` - Get all recipes for selection
- `GET /api/recipe/ingredients` - Get recipe ingredients
- `POST /api/recipe/ai-import` - AI-powered recipe import
- `PUT /api/recipe/update-*` - Various recipe update endpoints
- `DELETE /api/recipe/delete` - Delete recipe

**Collection Management APIs:**
- `POST /api/collections/create` - Create new collection
- `DELETE /api/collections/delete` - Delete collection

**Ingredient Management APIs:**
- `POST /api/ingredients/add` - Add new ingredient
- `PUT /api/ingredients/update` - Update ingredient
- `DELETE /api/ingredients/delete` - Delete ingredient

**Admin APIs:**
- `GET /api/admin/users` - User management
- `POST /api/admin/migrate` - Database migrations
- `GET /api/admin/migrations/status` - Migration status

## Current User Experience Flows

### Collection Browsing Flow
1. **Discovery**: Users see all 14 collections globally
2. **Browsing**: Click collection → see all recipes in that collection
3. **Recipe View**: View recipe details, ingredients, instructions
4. **No Ownership**: All collections appear the same regardless of user

### Meal Planning Flow
1. **Week Selection**: Choose week to plan (current or future)
2. **Recipe Selection**: Choose from ALL recipes across ALL collections
3. **Save Plan**: Recipes saved globally for that week
4. **Global State**: All users see the same meal plan for any given week

### Shopping List Flow
1. **Generation**: Auto-generated from planned recipes for specific week
2. **Ingredient Grouping**: Complex logic groups ingredients by name + measurement
3. **Fresh/Pantry Split**: Shopping list separated into fresh and pantry sections
4. **Global Lists**: Shopping list is global - all users see same items
5. **Purchase Tracking**: Items can be marked as purchased

### Recipe Management Flow
1. **Creation**: Any user can create recipes in any collection
2. **Editing**: Any user can edit any recipe
3. **Deletion**: Any user can delete any recipe
4. **No Conflicts**: No conflict resolution between users

## Current Limitations & Technical Debt

### Data Isolation Issues
1. **No User Boundaries**: All data globally accessible despite authentication
2. **Concurrent Editing**: Multiple users can edit same recipe simultaneously
3. **Shared State Conflicts**: Meal plans and shopping lists are global
4. **No Ownership Tracking**: Cannot determine who created what

### Query Performance
1. **No Scoping**: Queries always scan entire database
2. **Missing Indexes**: Some queries could benefit from household-specific indexes
3. **Complex Joins**: Shopping list generation requires complex multi-table joins

### Authentication vs Authorization Gap
1. **Authentication Exists**: Users must log in to access system
2. **No Authorization**: All authenticated users have same permissions
3. **Admin Only**: Only admin users vs regular users distinction
4. **No Resource Ownership**: No concept of who owns recipes/collections

### Shopping List Complexity
1. **Manual Grouping**: Complex logic to group ingredients by name + measurement
2. **Ingredient Deduplication**: Multiple recipes with same ingredient must be aggregated
3. **Fresh/Pantry Logic**: Categories determine shopping list section
4. **Quantity Aggregation**: Different quantity formats require normalization

## Migration Preparation

### Tables Requiring Household Integration
1. **users** - Add household_id foreign key and role
2. **collections** - Add household_id and sharing flags
3. **recipes** - Add household_id and parent_id for copy-on-write
4. **ingredients** - Add household_id and parent_id for copy-on-write
5. **plans** - Add household_id for scoped meal planning
6. **shopping_lists** - Add household_id for scoped shopping

### Queries Requiring Scoping
1. **Global Recipe Queries** - Scope to accessible recipes
2. **Collection Browsing** - Filter by owned + subscribed collections
3. **Ingredient Selection** - Scope to available ingredients
4. **Meal Planning** - Scope to household's planned weeks
5. **Shopping Lists** - Scope to household's shopping items

### API Endpoints Requiring Updates
- All endpoints need household context from authenticated user
- Permission checks needed for editing/deleting resources
- Collection subscription endpoints need to be added
- Member management endpoints need to be created

## System Strengths to Preserve

### Database Design
1. **Clean Schema**: Well-normalized relational design
2. **Flexible Relationships**: Junction tables support many-to-many relationships
3. **Extensible**: Easy to add household concepts without major restructuring

### Query Performance
1. **Indexed Access**: Proper indexing on key fields
2. **Connection Pooling**: Efficient database connection management
3. **Prepared Statements**: All queries use parameterized statements

### Authentication Foundation
1. **Secure Hashing**: Django-compatible password security
2. **Session Management**: Robust session handling
3. **API Protection**: All endpoints properly authenticated

### User Experience
1. **Intuitive Workflows**: Current meal planning and shopping flows work well
2. **Recipe Management**: Rich recipe creation and editing capabilities
3. **Search and Discovery**: Good recipe search and collection browsing

This current system provides a solid foundation for household features while clearly identifying what needs to be modified to support multi-household tenancy with proper data isolation and sharing capabilities.