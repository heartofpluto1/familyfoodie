# Agent 3: Frontend Integration

**Parent Spec:** [005-household-feature-spec.md](../specs/005-household-feature-spec.md)  
**Agent Role:** Frontend Integration Specialist  
**Assigned Sections:** Application Layer Changes (§6), User Experience Integration

## Scope & Responsibilities

This agent is responsible for integrating household context from Agent 2's authentication system into all frontend components and updating them to work with the new household-aware backend APIs.

### Primary Deliverables

1. **React Context Integration**
   - Consume SessionUser interface from Agent 2's authentication
   - Update AuthContext to provide household information
   - Create household-specific hooks for component access

2. **TypeScript Interface Updates**
   - Update all type definitions to include household ownership
   - Create new types for household, subscription, and junction table entities
   - Update existing Recipe, Collection, and Ingredient interfaces

3. **Frontend Component Integration**
   - Update all data fetching to use new household-scoped APIs
   - Integrate copy-on-write logic into edit workflows
   - Add collection subscription management UI
   - Update search components for household precedence

4. **User Experience Enhancements**
   - Add loading states for copy-on-write operations
   - Implement subscription status indicators
   - Create permission-aware UI (edit/copy buttons)
   - Add household context awareness throughout the app

## Detailed Task Breakdown

### Phase 1: React Context Integration (Days 1-2)

#### Task 1.1: AuthContext Provider Updates  
Update React context to consume household information from Agent 2's authentication system:
```typescript
// src/app/components/AuthProvider.tsx
// Import SessionUser interface from Agent 2's auth module
import { SessionUser } from '@/lib/auth';

interface AuthContextType {
  user: SessionUser | null;        // Uses Agent 2's interface
  household_id: number | null;     // Direct household access
  household_name: string | null;   // For UI display
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// Update AuthProvider to extract household context from SessionUser
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const contextValue = {
    user,
    household_id: user?.household_id || null,
    household_name: user?.household_name || null,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
```

#### Task 1.2: Household Context Hooks
Create convenient hooks for accessing household information:
```typescript
// src/hooks/useHousehold.ts
export function useHousehold() {
  const { household_id, household_name } = useAuth();
  
  return {
    household_id,
    household_name,
    isAuthenticated: !!household_id,
  };
}

// src/hooks/usePermissions.ts
export function usePermissions() {
  const { household_id } = useAuth();
  
  return {
    canEdit: (resource: { household_id: number }) => 
      household_id === resource.household_id,
    canSubscribe: (collection: { access_type: string }) => 
      collection.access_type === 'public',
  };
}
```

### Phase 2: TypeScript Interface Updates (Days 3-4)

#### Task 2.1: Core Type Definitions
Create new household-related types:
```typescript
// src/types/household.ts
export interface Household {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

// src/types/collection-recipe.ts  
export interface CollectionRecipe {
  collection_id: number;
  recipe_id: number;
  added_at: string;
  display_order: number;
}

// src/types/collection-subscription.ts
export interface CollectionSubscription {
  household_id: number;
  collection_id: number;
  subscribed_at: string;
}
```

#### Task 2.2: Interface Updates
Update existing interfaces to include household ownership:
```typescript
// Update src/types/collection.ts
export interface Collection {
  id: number;
  title: string;
  subtitle?: string;
  filename?: string;
  filename_dark?: string;
  household_id: number;    // NEW: ownership
  public: boolean;         // NEW: sharing control
  parent_id?: number;      // NEW: copy tracking
  url_slug: string;
  access_type?: 'owned' | 'subscribed' | 'public'; // NEW: UI state
}

// Update src/types/recipe.ts
export interface Recipe {
  id: number;
  name: string;
  prepTime?: number;
  cookTime: number;
  description?: string;
  household_id: number;    // NEW: NOT NULL ownership
  parent_id?: number;      // NEW: copy tracking
  url_slug: string;
  image_filename?: string;
  pdf_filename?: string;
  
  // Collection context for UI routing and copy-on-write (populated by queries)
  current_collection_id?: number;  // Context-aware: which collection is user accessing this through
  current_collection_slug?: string; // For URL generation after copy-on-write
  access_context?: {
    collection_household_id: number;
    recipe_household_id: number;
    user_owns_collection: boolean;
    user_owns_recipe: boolean;
  };
  
  // Extended properties for UI
  status?: 'original' | 'customized' | 'referenced'; // NEW: precedence status
  collections?: string;    // NEW: comma-separated list from search
}

// Update src/types/ingredient.ts  
export interface Ingredient {
  id: number;
  name: string;
  fresh: boolean;
  household_id: number;    // NEW: NOT NULL ownership
  parent_id?: number;      // NEW: copy tracking
  cost?: number;
  public: boolean;
  supermarketCategory_id: number;
  pantryCategory_id: number;
}
```

### Phase 3: Data Fetching Integration (Days 5-7)

#### Task 3.1: Collection Data Fetching
Update existing recipes page to show collections with server-side queries:
```typescript
// src/app/recipes/page.tsx - Update existing recipes page to show collections
import { getMyCollections, getPublicCollections } from '@/lib/queries/collections';
import { validateSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function RecipesPage() {
  // Get user session for household context
  const session = await validateSession();
  if (!session) {
    redirect('/login');
  }

  // Server-side data fetching - runs in parallel
  const [myCollections, publicCollections] = await Promise.all([
    getMyCollections(session.household_id), // Household's owned and subscribed collections
    getPublicCollections(session.household_id) // Browsable public collections
  ]);

  return (
    <div>
      {/* My Collections Section */}
      <section>
        <h2>My Collections</h2>
        {myCollections.map(collection => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            isSubscribed={true} // All collections in "My Collections" are subscribed/owned
            canToggleSubscription={collection.access_type === 'subscribed'} // Can only unsubscribe from subscribed collections (not owned)
            onToggleSubscription={handleToggleSubscription}
          />
        ))}
      </section>

      {/* Public Collections Section */}
      <section>
        <h2>Browse Public Collections</h2>
        {publicCollections.map(collection => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            isSubscribed={false} // All public collections are not yet subscribed
            canToggleSubscription={true} // Can subscribe to any public collection
            onToggleSubscription={handleToggleSubscription}
          />
        ))}
      </section>
    </div>
  );
}
```

#### Task 3.2: Recipe Data Fetching with Precedence
Update existing collection recipe page with server-side data fetching:
```typescript
// src/app/recipes/[collection_slug]/page.tsx - Update existing collection recipe page
import { getCollectionBySlug, getRecipesInCollection } from '@/lib/queries/collections';
import { validateSession } from '@/lib/auth';

interface CollectionRecipesPageProps {
  params: { collection_slug: string };
}

export default async function CollectionRecipesPage({ params }: CollectionRecipesPageProps) {
  // Get user session for household context
  const session = await validateSession();
  if (!session) {
    redirect('/login');
  }

  // Server-side data fetching - runs in parallel
  const [collection, recipes] = await Promise.all([
    getCollectionBySlug(params.collection_slug, session.household_id),
    getRecipesInCollection(params.collection_slug, session.household_id) // Uses enhanced household precedence logic
  ]);

  const handleViewRecipe = (recipe: Recipe) => {
    // Navigate to recipe details page (not edit page)
    const collectionSlug = recipe.current_collection_slug || params.collection_slug;
    window.location.href = `/recipes/${collectionSlug}/${recipe.url_slug}`;
  };

  return (
    <div>
      <h1>{collection?.title || params.collection_slug}</h1>
      {recipes.map(recipe => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          showStatus={true} // Show customized/original/referenced status
          onViewRecipe={() => handleViewRecipe(recipe)}
        />
      ))}
    </div>
  );
}
```

### Phase 4: Copy-on-Write UI Integration (Days 8-10)

#### Task 4.1: Edit Flow Integration
Update existing recipe details page to include copy-on-write logic for editing:
```typescript
// src/app/recipes/[collection_slug]/[recipe_slug]/page.tsx - Update existing recipe details page
import { getRecipeBySlug } from '@/lib/queries/recipes';
import { validateSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

interface RecipeDetailsPageProps {
  params: { collection_slug: string; recipe_slug: string };
}

export default async function RecipeDetailsPage({ params }: RecipeDetailsPageProps) {
  // Get user session for household context
  const session = await validateSession();
  if (!session) {
    redirect('/login');
  }

  // Server-side data fetching for recipe with collection context
  const recipe = await getRecipeBySlug(params.recipe_slug, params.collection_slug, session.household_id);
  
  if (!recipe) {
    redirect('/404');
  }

  return <RecipeDetailsClient recipe={recipe} params={params} />;
}

// Update existing client component to include copy-on-write logic
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RecipeDetailsClientProps {
  recipe: Recipe;
  params: { collection_slug: string; recipe_slug: string };
}

function RecipeDetailsClient({ recipe, params }: RecipeDetailsClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const router = useRouter();
  
  const handleSave = async (updatedRecipe: Recipe) => {
    if (!recipe?.current_collection_id) {
      console.error('Missing collection context for copy-on-write');
      return;
    }
    
    setIsCopying(true);
    
    try {
      // Copy-on-write triggered ONLY when user submits changes via this API call
      const response = await fetch(`/api/recipes/${params.recipe_slug}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updatedRecipe,
          collection_id: recipe.current_collection_id, // Include collection context
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Handle cascade copy results
        if (result.actions_taken && result.actions_taken.length > 0) {
          const { new_collection_slug, new_recipe_slug } = result;
          
          // Redirect to new URLs if resources were copied
          const newCollectionSlug = new_collection_slug || params.collection_slug;
          const newRecipeSlug = new_recipe_slug || params.recipe_slug;
          
          // Note: User is automatically unsubscribed from original collection when copied
          router.push(`/recipes/${newCollectionSlug}/${newRecipeSlug}`);
        } else {
          // No copy-on-write needed, just exit edit mode
          setIsEditing(false);
        }
      }
    } finally {
      setIsCopying(false);
    }
  };

  if (isCopying) {
    const copyingActions = recipe?.access_context ? [
      !recipe.access_context.user_owns_collection && 'collection',
      !recipe.access_context.user_owns_recipe && 'recipe'
    ].filter(Boolean).join(' and ') : 'resources';
    
    return <div>Creating your personalized {copyingActions}...</div>;
  }

  return (
    <div>
      {/* Recipe details view/edit toggle */}
      {isEditing ? (
        <RecipeEditForm 
          recipe={recipe} 
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <RecipeDetailsView 
          recipe={recipe}
          onEdit={() => setIsEditing(true)}
          showEditButton={recipe.access_context?.user_owns_recipe || recipe.access_context?.user_owns_collection}
        />
      )}
    </div>
  );
}
```

#### Task 4.2: Subscription Toggle UI
Simplified subscription toggle - same component across both lists with different toggle states:
```typescript
// src/app/components/CollectionCard.tsx
interface CollectionCardProps {
  collection: Collection;
  isSubscribed: boolean;
  canToggleSubscription: boolean;
  onToggleSubscription: (collection: Collection, currentlySubscribed: boolean) => void;
}

const CollectionCard = ({ collection, isSubscribed, canToggleSubscription, onToggleSubscription }: CollectionCardProps) => {
  return (
    <div className="collection-card">
      {/* Collection content */}
      <h3>{collection.title}</h3>
      <p>{collection.subtitle}</p>
      
      {/* Subscription toggle */}
      {canToggleSubscription && (
        <SubscriptionToggle
          collection={collection}
          isSubscribed={isSubscribed}
          onToggle={() => onToggleSubscription(collection, isSubscribed)}
        />
      )}
      
      {!canToggleSubscription && isSubscribed && (
        <span className="owned-badge">Owned</span>
      )}
    </div>
  );
};

// Note: Collection copying happens automatically when users:
// 1. Edit collection metadata (title, subtitle, etc.) they don't own
// 2. Edit recipes/ingredients in collections they don't own
// No explicit "Copy Collection" UI needed - copy-on-write handles it transparently
```

### Phase 5: Subscription Management UI (Days 11-12)

#### Task 5.1: Collection Subscription Toggle Component
Create a unified subscription toggle button component with icon:
```typescript
// src/app/components/SubscriptionToggle.tsx
import { BookmarkIcon, BookmarkSlashIcon } from '@/app/components/Icons';

interface SubscriptionToggleProps {
  collection: Collection;
  isSubscribed: boolean;
  onToggle: () => Promise<void>;
}

const SubscriptionToggle = ({ collection, isSubscribed, onToggle }: SubscriptionToggleProps) => {
  const [loading, setLoading] = useState(false);
  
  const handleToggle = async () => {
    setLoading(true);
    try {
      await onToggle();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`subscription-toggle ${isSubscribed ? 'subscribed' : 'unsubscribed'}`}
    >
      {loading ? (
        <span>Loading...</span>
      ) : (
        <>
          {isSubscribed ? <BookmarkIcon /> : <BookmarkSlashIcon />}
          <span>{isSubscribed ? 'Subscribed' : 'Subscribe'}</span>
        </>
      )}
    </button>
  );
};

// Add to src/app/components/Icons.tsx
export function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

export function BookmarkSlashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3l18 18"
      />
    </svg>
  );
}
```

#### Task 5.2: Subscription Status Indicators
Add visual indicators for subscription status throughout the app:
- Collection cards show subscription badges
- Collection lists grouped by access type (owned/subscribed/public)
- Recipe cards show source collection subscription status

### Phase 6: Search & Filtering Updates (Day 13)

#### Task 6.1: Recipe Search Integration
No changes needed to RecipeSearch component - permission boundaries and household precedence are handled entirely at the API level:
```typescript
// src/app/components/RecipeSearch.tsx
// Component remains unchanged - existing search functionality works as-is
// The API endpoints (/api/recipes/search) will handle:
// - Household context from session authentication
// - Permission boundaries for recipe visibility
// - Household precedence in search results
// - Filtering based on accessible collections

// Frontend simply calls existing search API - no household_id parameter needed
const RecipeSearch = ({ onSearch, resultsCount, totalCount }: RecipeSearchProps) => {
  const handleSearch = useCallback((searchTerm: string) => {
    onSearch(`/api/recipes/search?q=${searchTerm}`);
  }, [onSearch]);

  // Component continues to work exactly as before
};
```

#### Task 6.2: Meal Planning Integration
Update meal planning with server-side data fetching for subscription-scoped recipe access:
```typescript
// src/app/plan/page.tsx - Meal planning page
import { getMyRecipes } from '@/lib/queries/recipes';
import { validateSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function PlanPage() {
  // Get user session for household context
  const session = await validateSession();
  if (!session) {
    redirect('/login');
  }

  // Server-side data fetching - household owned recipes + recipes from subscribed collections
  const availableRecipes = await getMyRecipes(session.household_id);
  
  return <PlanPageClient availableRecipes={availableRecipes} />;
}

// Separate client component for meal planning interactions
'use client';
interface PlanPageClientProps {
  availableRecipes: Recipe[];
}

function PlanPageClient({ availableRecipes }: PlanPageClientProps) {
  // Rest of meal planning logic remains the same with client-side state for user interactions
  // availableRecipes is pre-loaded from server
};
```

## Dependencies

### Upstream Dependencies (Must Complete First)
- **Agent 1**: Database migration completed with Spencer household
- **Agent 2**: Authentication system updated with household context (Phase 0)
- **Agent 2**: API endpoints implemented with household context
- **Agent 2**: Subscription management APIs working

### Downstream Dependencies (Other Agents Depend On)  
- None - this agent completes the household feature implementation

## Success Criteria

### Frontend Context Requirements
- [ ] AuthContext successfully consumes household context from Agent 2's SessionUser interface
- [ ] Household context hooks provide convenient access to household information
- [ ] All components can access household_id and household_name through useAuth()

### Frontend Integration Requirements
- [ ] All data fetching updated to use household-scoped APIs with collection context
- [ ] Copy-on-write flows integrated with appropriate loading states
- [ ] Collection subscription management fully functional in UI
- [ ] Recipe search showing household precedence correctly
- [ ] Collection context preserved throughout navigation and editing workflows

### Copy-on-Write UI Requirements (Enhanced)
- [ ] Recipe editing URLs follow `/recipes/[collection_slug]/[recipe_slug]/edit` pattern
- [ ] Collection context-aware cascade copying implemented
- [ ] Loading states indicate what resources are being copied (collection, recipe, ingredient)
- [ ] URL redirection after copy-on-write maintains user navigation flow
- [ ] Edit warnings display when user doesn't own collection or recipe

### User Experience Requirements
- [ ] Loading states for all copy-on-write operations with specific resource feedback
- [ ] Clear visual indicators for subscription status and ownership
- [ ] Permission-aware UI (edit/copy buttons only when appropriate)
- [ ] Smooth transitions between original and copied content with proper URL updates
- [ ] Context-aware messaging for multi-resource copying scenarios

### Type Safety Requirements
- [ ] Recipe interface includes collection context fields (current_collection_id, access_context)
- [ ] All TypeScript interfaces updated with household context
- [ ] No type errors in household-related code
- [ ] Proper typing for enhanced copy-on-write API responses

## Risk Mitigation

### High Risk: React Context Integration Bugs
- **Mitigation**: Comprehensive testing of AuthContext consuming Agent 2's SessionUser
- **Rollback**: Fallback to simplified context without household features

### Medium Risk: UI State Management Complexity  
- **Mitigation**: Clear separation of concerns, comprehensive component testing
- **Rollback**: Simplified UI without advanced features

### Medium Risk: Copy-on-Write UI Confusion
- **Mitigation**: User testing, clear loading states and messaging
- **Rollback**: Direct edit without copy-on-write warning

## Testing Strategy

1. **React Context Tests**: Test AuthContext integration with Agent 2's SessionUser interface
2. **Component Tests**: Test all updated components with household data
3. **Integration Tests**: Test complete user flows end-to-end
4. **User Experience Tests**: Test copy-on-write flows with real user scenarios  
5. **Permission Tests**: Verify UI properly respects household boundaries

## Integration Points with Other Agents

### Depends on Agent 1:
- Spencer household created and all users migrated
- Database schema ready for household-aware queries

### Depends on Agent 2:  
- Authentication system foundation implemented (SessionUser, withAuth middleware, permissions)
- All API endpoints implemented and tested with household context
- Subscription management APIs working
- Copy-on-write logic integrated into API layer

### Provides to System:
- Complete household feature implementation
- User-facing household functionality
- Subscription management interface

## Handoff Documentation

Upon completion, provide:
- Updated component library with household context examples
- Frontend integration guide showing how to consume Agent 2's authentication
- Copy-on-write user experience documentation
- Subscription management UI pattern library
- Complete user journey documentation for household features