# Collections Browsing & Recipe Discovery Specification

## Executive Summary

This document captures the current collections browsing and recipe discovery system in the FamilyFoodie application. The system provides sophisticated visual design, SEO-friendly URLs, advanced search capabilities, and rich user interactions for browsing recipe collections and discovering recipes. This specification serves as a foundation reference before implementing household-scoped collection browsing.

## Current System Overview

### Core Concepts
- **Collection-Based Organization**: Recipes organized into thematic collections
- **SEO-Friendly URLs**: Clean URL structure with slugs for collections and recipes
- **Visual-First Design**: Rich visual cards with custom imagery and animations
- **Global Access**: All users can browse all collections and recipes
- **Advanced Search**: Multi-field search across recipes with real-time results
- **Rich Media Support**: Custom collection and recipe images with dark/light mode variants

### Business Logic
- **Collection Discovery**: Visual grid of collections with recipe counts
- **Recipe Browsing**: Collection-specific recipe listings with search
- **Recipe Details**: Full recipe pages with ingredients and instructions
- **Content Management**: Create, edit, and delete collections and recipes
- **AI Integration**: PDF-to-recipe import using AI processing

## Database Architecture & URL System

### Collection URL Structure

```sql
-- Collections table with SEO-friendly slugs
CREATE TABLE collections (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  url_slug VARCHAR(255) NOT NULL DEFAULT '1-initial',  -- "42-italian-classics"
  filename VARCHAR(255) DEFAULT 'custom_collection_004',
  filename_dark VARCHAR(255) DEFAULT 'custom_collection_004_dark',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_url_slug (url_slug)
);

-- Recipes with collection relationship and slugs
CREATE TABLE recipes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  collection_id INT DEFAULT NULL,  -- FK to collections
  url_slug VARCHAR(255) NOT NULL,  -- "123-chicken-carbonara"
  image_filename VARCHAR(100) DEFAULT NULL,
  pdf_filename VARCHAR(100) DEFAULT NULL,
  -- other recipe fields...
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_collection_id (collection_id),
  INDEX idx_recipe_url_slug (url_slug)
);
```

### URL Routing Architecture

#### Next.js App Router Structure
```
src/app/recipes/
├── page.tsx                              # /recipes (collections grid)
├── collections-client.tsx                # Collection listing component
├── [collection-slug]/
│   ├── page.tsx                         # /recipes/{collection-slug}
│   ├── collection-client.tsx            # Single collection view
│   └── [recipe-slug]/
│       ├── page.tsx                     # /recipes/{collection-slug}/{recipe-slug}
│       └── recipe-details-client.tsx    # Recipe detail view
```

#### URL Pattern Examples
```
/recipes                                 # Collections listing
/recipes/42-italian-classics             # Collection: "Italian Classics" (ID 42)
/recipes/42-italian-classics/123-chicken-carbonara  # Recipe: "Chicken Carbonara" (ID 123)
```

### URL Parsing & Validation

```typescript
// src/lib/utils/urlHelpers.ts

// Parse collection slug: "42-italian-classics" → {id: 42, slug: "italian-classics"}
export function parseSlugPath(slug: string): { id: number; slug: string } | null {
  const match = slug.match(/^(\d+)-(.+)$/);
  if (!match) return null;
  
  const id = parseInt(match[1]);
  if (isNaN(id)) return null;
  
  return { id, slug: match[2] };
}

// Parse recipe URL: collection + recipe slugs
export function parseRecipeUrl(collectionSlug: string, recipeSlug: string) {
  const collection = parseSlugPath(collectionSlug);
  const recipe = parseSlugPath(recipeSlug);
  
  if (!collection || !recipe) return null;
  
  return {
    collectionId: collection.id,
    recipeId: recipe.id
  };
}

// Generate SEO-friendly slug from title
export function generateSlugFromTitle(id: number, title: string): string {
  const slugBase = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Collapse multiple hyphens
    .trim();
    
  return `${id}-${slugBase}`;
}
```

### URL Validation & Redirects

```typescript
// Automatic SEO redirects for consistency
async function RecipesPage({ params }: { params: { 'collection-slug': string } }) {
  const parsed = parseSlugPath(params['collection-slug']);
  if (!parsed) redirect('/recipes'); // Invalid format
  
  const collection = await getCollectionById(parsed.id);
  if (!collection) notFound(); // Collection doesn't exist
  
  // Redirect if slug doesn't match current url_slug (SEO consistency)
  if (params['collection-slug'] !== collection.url_slug) {
    redirect(`/recipes/${collection.url_slug}`);
  }
  
  return <CollectionClient collection={collection} />;
}
```

## Visual Design System

### CollectionCard Component

```typescript
// Sophisticated collection card with visual effects
interface CollectionCardProps {
  coverImage: string;
  darkCoverImage?: string;    // Dark mode variant
  title?: string;
  subtitle?: string;
  subscribed: boolean;        // Subscription status
  recipeCount?: number;       // Number of recipes
}

// Visual Features:
// - Layered "peek cards" behind main card for depth
// - Dark/light mode image support via <picture> element
// - Recipe count badge in triangular corner
// - Subscribe/unsubscribe button for non-owned collections
// - Hover effects and scaling animations
```

#### Collection Card Visual Features
- **Peek Card Effect**: Multiple background cards with slight rotation for depth
- **Dark Mode Images**: Separate images for dark/light themes
- **Recipe Count Badge**: Triangular corner badge showing number of recipes
- **Subscription UI**: Visual indication of subscription status
- **Custom Dimensions**: Fixed 296px × 410px with responsive grid

### RecipeCard Component

```typescript
// Advanced recipe card with animations
interface RecipeCardProps {
  recipe: Recipe;
  showControls?: boolean;     // Show swap/remove buttons
  onSwapRecipe?: (recipe: Recipe) => Promise<Recipe | null>;
  onCommitSwap?: (old: Recipe, new: Recipe) => void;
  onRemoveRecipe?: (recipe: Recipe) => void;
  triggerAnimation?: boolean; // External animation trigger
}

// Animation Features:
// - 3D flip animation (rotateY) for recipe swapping
// - Image preloading before animation starts
// - Mirror effect handling during rotation
// - Smooth transitions with easing
```

#### Recipe Card Advanced Features
- **3D Flip Animation**: CSS transforms with perspective for realistic card flip
- **Image Preloading**: Ensures smooth animations by preloading images
- **Cost Display**: Price badges for recipes with cost information
- **Time Indicators**: Combined prep + cook time with smart formatting
- **Control Buttons**: Swap and remove buttons with positional awareness

### Search Interface

```typescript
// Real-time search with URL synchronization
interface RecipeSearchProps {
  onSearch: (searchTerm: string) => void;
  resultsCount: number;
  totalCount: number;
  initialSearchTerm?: string;
}

// Search Features:
// - 200ms debounced input for performance
// - URL parameter synchronization (?search=term)
// - Real-time result counting
// - Multi-field search (name, description, season, ingredients)
// - Clear button with smooth interactions
```

## User Experience Flows

### Collection Discovery Flow

1. **Landing Page**: `/recipes` shows grid of all collections
2. **Visual Browsing**: Users see collection cards with:
   - Custom cover images (light/dark variants)
   - Collection titles and subtitles
   - Recipe counts in corner badges
   - Subscription indicators
3. **Collection Selection**: Click navigates to `/recipes/{collection-slug}`
4. **Collection Management**: Add new collection button with visual prominence

#### Collections Grid Implementation
```typescript
// src/app/recipes/collections-client.tsx
const CollectionsPageClient = ({ collections }: { collections: Collection[] }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {collections.map(collection => (
        <Link
          key={collection.id}
          href={`/recipes/${collection.url_slug}`}
          className="block hover:scale-105 hover:rotate-1 transition-transform duration-200"
        >
          <CollectionCard
            coverImage={getCollectionImageUrl(collection.filename)}
            darkCoverImage={getCollectionDarkImageUrl(collection.filename_dark)}
            title={collection.title}
            subtitle={collection.subtitle}
            subscribed={true} // Currently always true (global access)
            recipeCount={collection.recipe_count}
          />
        </Link>
      ))}
    </div>
  );
};
```

### Collection Browsing Flow

1. **Collection Header**: Shows collection details with small card representation
2. **Recipe Grid**: Displays all recipes in the collection
3. **Search Integration**: Real-time search within collection
4. **AI Import**: Prominent button for PDF recipe import
5. **Recipe Management**: Edit/delete controls on hover

#### Collection Page Implementation
```typescript
// Multi-field recipe search within collection
const filteredRecipes = useMemo(() => {
  if (!searchTerm.trim()) return recipes;
  
  const search = searchTerm.toLowerCase();
  return recipes.filter(recipe => {
    // Search in recipe name
    if (recipe.name.toLowerCase().includes(search)) return true;
    
    // Search in description
    if (recipe.description?.toLowerCase().includes(search)) return true;
    
    // Search in season name
    if (recipe.seasonName?.toLowerCase().includes(search)) return true;
    
    // Search in ingredients array
    if (recipe.ingredients?.some(ingredient => 
      ingredient.toLowerCase().includes(search)
    )) return true;
    
    return false;
  });
}, [recipes, searchTerm]);
```

### Recipe Detail Flow

1. **SEO URLs**: Clean URLs like `/recipes/collection-slug/recipe-slug`
2. **URL Validation**: Automatic redirects for consistency
3. **Rich Content**: Full recipe details with ingredients table
4. **Edit Mode**: In-place editing with sophisticated components
5. **Media Management**: Image and PDF upload/management

#### Recipe Detail Implementation
```typescript
// URL validation with automatic SEO redirects
async function RecipeDetailsPage({ params }: PageProps) {
  const parsed = parseRecipeUrl(params['collection-slug'], params['recipe-slug']);
  if (!parsed) notFound();
  
  const recipe = await getRecipeDetails(parsed.recipeId.toString());
  if (!recipe) notFound();
  
  // Validate recipe belongs to specified collection
  if (recipe.collection_id !== parsed.collectionId) {
    redirect(`/recipes/${recipe.collection_url_slug}/${recipe.url_slug}`);
  }
  
  // SEO consistency redirects
  if (params['collection-slug'] !== recipe.collection_url_slug || 
      params['recipe-slug'] !== recipe.url_slug) {
    redirect(`/recipes/${recipe.collection_url_slug}/${recipe.url_slug}`);
  }
  
  return <RecipeDetailsClient recipe={recipe} />;
}
```

## API Architecture

### Collection Management Endpoints

#### Collection Creation
```typescript
// POST /api/collections/create
// Sophisticated collection creation with image handling
interface CreateCollectionRequest {
  title: string;
  subtitle?: string;
  lightImage?: File;     // Custom light mode image
  darkImage?: File;      // Custom dark mode image
}

// Features:
// - Custom image upload with validation (JPG only)
// - Secure filename generation
// - Storage abstraction (local/GCS)
// - Automatic slug generation
// - Default image fallbacks
```

#### Collection Deletion
```typescript
// DELETE /api/collections/delete
// Safe deletion with validation
interface DeleteCollectionRequest {
  collectionId: number;
}

// Safety Features:
// - Recipe dependency checking
// - File cleanup (images)
// - Default image protection
// - Transaction safety
```

### Image Management System

#### Secure Filename Generation
```typescript
// Secure filename generation prevents enumeration attacks
export function generateCollectionSecureFilename(id: number, title: string): string {
  const hash = crypto.createHash('sha256')
    .update(`${id}-${title}-${process.env.FILENAME_SALT}`)
    .digest('hex')
    .substring(0, 8);
    
  return `collection_${id}_${hash}`;
}

// URL generation with CDN support
export function getCollectionImageUrl(filename?: string): string {
  if (!filename) return '/images/collections/default.jpg';
  return `/images/collections/${filename}.jpg`;
}

export function getCollectionDarkImageUrl(filename?: string): string {
  if (!filename) return '/images/collections/default_dark.jpg';
  return `/images/collections/${filename}.jpg`;
}
```

### Storage Abstraction

```typescript
// Support for multiple storage backends
export interface StorageResult {
  success: boolean;
  error?: string;
  url?: string;
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  extension: string,
  mimeType: string,
  directory: string
): Promise<StorageResult> {
  const mode = getStorageMode(); // 'local' | 'gcs'
  
  if (mode === 'gcs') {
    return uploadToGCS(buffer, filename, extension, mimeType, directory);
  } else {
    return uploadToLocal(buffer, filename, extension, directory);
  }
}
```

## Advanced Features

### AI-Powered Recipe Import

```typescript
// Sophisticated PDF-to-recipe conversion
// URL: /recipes/{collection-slug}/import

interface AIImportFeatures {
  // PDF processing with AI extraction
  pdfToImages: (file: File) => Promise<string[]>;
  
  // AI recipe extraction from images
  extractRecipe: (images: string[]) => Promise<{
    name: string;
    description: string;
    ingredients: Array<{
      name: string;
      quantity: string;
      unit: string;
    }>;
    instructions: string[];
  }>;
  
  // Hero image extraction and cropping
  extractHeroImage: (images: string[]) => Promise<string>;
  
  // Recipe preview and editing before save
  previewMode: boolean;
}
```

### Recipe Card Animations

```typescript
// Advanced 3D flip animations for recipe swapping
interface AnimationFeatures {
  // 3D perspective transforms
  flipAnimation: {
    duration: '400ms';
    easing: 'ease-in-out';
    transform: 'rotateY(180deg)';
    perspective: '1000px';
  };
  
  // Image preloading for smooth animations
  preloadImage: (url: string) => Promise<void>;
  
  // Mirror effect handling during rotation
  contentMirroring: {
    transform: 'scaleX(-1)';
    timing: 'mid-animation'; // 200ms
  };
  
  // Animation state management
  states: 'idle' | 'flipping' | 'showing-new-content';
}
```

### Search System

```typescript
// Comprehensive search across multiple fields
interface SearchCapabilities {
  // Search fields
  fields: [
    'recipe.name',
    'recipe.description', 
    'recipe.seasonName',
    'recipe.ingredients[]'
  ];
  
  // Real-time features
  debounce: 200; // ms
  urlSync: true; // ?search=term
  resultCounting: true;
  
  // Performance optimizations
  clientSideFiltering: true; // Pre-loaded data
  caseInsensitive: true;
  trimming: true;
}
```

## Current Data Access Patterns

### Collection Queries

```sql
-- Get all collections with recipe counts (global access)
SELECT 
  c.id,
  c.title,
  c.subtitle,
  c.filename,
  c.filename_dark,
  c.url_slug,
  c.created_at,
  c.updated_at,
  COUNT(r.id) as recipe_count
FROM collections c
LEFT JOIN recipes r ON c.id = r.collection_id
GROUP BY c.id, c.title, c.subtitle, c.filename, c.filename_dark, c.url_slug, c.created_at, c.updated_at
ORDER BY c.id ASC;

-- Get single collection by ID
SELECT * FROM collections WHERE id = ?;
```

### Recipe Queries

```sql
-- Get recipes with details (includes ingredients, season, types)
SELECT DISTINCT
  r.id,
  r.name,
  r.image_filename,
  r.pdf_filename,
  r.prepTime,
  r.cookTime,
  r.description,
  r.url_slug,
  r.collection_id,
  c.title as collection_title,
  c.url_slug as collection_url_slug,
  s.name as seasonName,
  GROUP_CONCAT(DISTINCT i.name SEPARATOR ', ') as ingredients
FROM recipes r
INNER JOIN collections c ON r.collection_id = c.id
LEFT JOIN seasons s ON r.season_id = s.id
LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
LEFT JOIN ingredients i ON ri.ingredient_id = i.id
WHERE r.duplicate = 0
AND (r.collection_id = ? OR ? IS NULL)  -- Optional collection filter
GROUP BY r.id, r.name, r.image_filename, r.pdf_filename, r.prepTime, r.cookTime, r.description, r.url_slug, r.collection_id, c.title, c.url_slug, s.name
ORDER BY r.name ASC;
```

## Performance Characteristics

### Query Performance
- **Collection Loading**: Simple queries with LEFT JOINs for recipe counts
- **Recipe Browsing**: Complex queries with ingredient aggregation via GROUP_CONCAT
- **Search Performance**: Client-side filtering on pre-loaded data
- **Image Loading**: Lazy loading with progressive enhancement

### Memory Usage
- **Recipe Data**: All recipes with details loaded for search functionality
- **Image Caching**: Browser-level caching for collection/recipe images
- **Search State**: Real-time filtering maintains filtered arrays

### Storage Management
- **Image Storage**: Abstracted storage layer (local/GCS)
- **Secure Filenames**: Hash-based filenames prevent enumeration
- **File Cleanup**: Orphaned file cleanup during collection deletion

## Current Limitations & Technical Debt

### Data Isolation Issues
1. **Global Access**: All users can browse all collections and recipes
2. **No Ownership**: Cannot determine who created collections/recipes
3. **Shared Modifications**: All users can edit any collection/recipe

### Performance Considerations
1. **Recipe Loading**: Loads all recipes with ingredients for search
2. **No Pagination**: Collection and recipe grids show all items
3. **Complex Queries**: GROUP_CONCAT operations for ingredient aggregation

### User Experience Limitations
1. **No Personalization**: Cannot customize collection organization
2. **Shared State**: Changes by one user affect all users
3. **No Favorites**: Cannot save favorite collections or recipes

## Integration Points for Household System

### Database Changes Required
```sql
-- Add household scoping to collections
ALTER TABLE collections ADD COLUMN household_id INT NOT NULL;
ALTER TABLE collections ADD COLUMN public TINYINT(1) DEFAULT 0;
ALTER TABLE collections ADD FOREIGN KEY (household_id) REFERENCES households(id);

-- Collections will need subscription system
CREATE TABLE collection_subscriptions (
  household_id INT NOT NULL,
  collection_id INT NOT NULL,
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (household_id, collection_id)
);
```

### Query Updates Required
1. **Collection Browsing**: Filter by owned + subscribed + public collections
2. **Recipe Access**: Scope recipes by accessible collections
3. **Search Results**: Only search within accessible recipes
4. **Collection Management**: Verify ownership before edit/delete

### API Changes Required
1. **Authentication Context**: Extract household_id from user session
2. **Permission Checks**: Verify collection access before operations
3. **Subscription Endpoints**: Add collection subscribe/unsubscribe APIs
4. **Data Scoping**: Filter all queries by household accessibility

### Frontend Updates Required
1. **Collection Cards**: Show subscription status and actions
2. **Recipe Browsing**: Display only accessible recipes
3. **Search Scope**: Limit search to household-accessible content
4. **Collection Management**: Show ownership indicators

## System Strengths to Preserve

### Architecture Strengths
1. **SEO-Friendly URLs**: Clean, crawlable URL structure with slugs
2. **Visual Design**: Professional-quality card designs and animations
3. **Storage Abstraction**: Flexible storage backend support
4. **Type Safety**: Comprehensive TypeScript interfaces

### User Experience Strengths
1. **Intuitive Navigation**: Clear collection → recipe → details flow
2. **Advanced Search**: Multi-field search with real-time results
3. **Rich Visuals**: Custom imagery with dark/light mode support
4. **Smooth Animations**: Professional-quality transitions and effects
5. **AI Integration**: Modern PDF-to-recipe import functionality

### Technical Strengths
1. **URL Validation**: Automatic SEO redirects maintain consistency
2. **Image Security**: Secure filename generation prevents enumeration
3. **Error Handling**: Comprehensive 404 and validation handling
4. **Performance**: Client-side search with efficient data structures

This collections browsing system provides an excellent foundation for household-scoped browsing while maintaining the sophisticated user experience and robust technical architecture that users expect from a modern recipe application.