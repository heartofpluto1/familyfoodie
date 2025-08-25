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
Update all collection-related data fetching:
```typescript
// src/app/collections/page.tsx - Main collections page
export default function CollectionsPage() {
  const { household_id } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  
  useEffect(() => {
    // Use new household-scoped API
    fetch('/api/collections')
      .then(res => res.json())
      .then(data => setCollections(data));
  }, [household_id]);

  return (
    <div>
      {collections.map(collection => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          showSubscribeButton={collection.access_type === 'public'}
          onSubscribe={handleSubscribe}
          onUnsubscribe={handleUnsubscribe}
        />
      ))}
    </div>
  );
}
```

#### Task 3.2: Recipe Data Fetching with Precedence
Update recipe search and collection browsing:
```typescript
// src/app/collections/[slug]/page.tsx - Collection details
export default function CollectionPage({ params }: { params: { slug: string } }) {
  const { household_id } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  
  useEffect(() => {
    // Fetch collection details for context
    fetch(`/api/collections/${params.slug}`)
      .then(res => res.json())
      .then(data => setCollection(data));
    
    // Uses enhanced household precedence logic from Agent 2 with collection context
    fetch(`/api/collections/${params.slug}/recipes`)
      .then(res => res.json())
      .then(data => setRecipes(data)); // Recipes now include access_context
  }, [params.slug, household_id]);

  const handleEditRecipe = (recipe: Recipe) => {
    // Navigate to collection-aware edit URL
    const collectionSlug = recipe.current_collection_slug || params.slug;
    window.location.href = `/recipes/${collectionSlug}/${recipe.url_slug}/edit`;
  };

  return (
    <div>
      <h1>{collection?.title}</h1>
      {recipes.map(recipe => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          showStatus={true} // Show customized/original/referenced status
          showCopyWarning={!recipe.access_context?.user_owns_recipe || !recipe.access_context?.user_owns_collection}
          onEditRecipe={() => handleEditRecipe(recipe)}
        />
      ))}
    </div>
  );
}
```

### Phase 4: Copy-on-Write UI Integration (Days 8-10)

#### Task 4.1: Edit Flow Integration
Add copy-on-write logic to all edit operations:
```typescript
// src/app/recipes/[collection_slug]/[recipe_slug]/edit/page.tsx
export default function EditRecipePage({ 
  params 
}: { 
  params: { collection_slug: string; recipe_slug: string } 
}) {
  const { household_id } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const router = useRouter();
  
  // Load recipe data for editing (NO copy-on-write triggered here)
  useEffect(() => {
    fetch(`/api/recipes/${params.recipe_slug}?collection_slug=${params.collection_slug}`)
      .then(res => res.json())
      .then(data => setRecipe(data));
  }, [params.recipe_slug, params.collection_slug]);
  
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

  return <RecipeEditForm recipe={recipe} onSave={handleSave} />;
}
```

#### Task 4.2: Collection Copying UI
Add collection copying functionality:
```typescript
// src/app/components/CollectionCard.tsx
interface CollectionCardProps {
  collection: Collection;
  showSubscribeButton?: boolean;
  showCopyButton?: boolean;
  onSubscribe?: (collection: Collection) => void;
  onUnsubscribe?: (collection: Collection) => void;
  onCopy?: (collection: Collection) => void;
}

const CollectionCard = ({ collection, showCopyButton, onCopy }: CollectionCardProps) => {
  const [isCopying, setIsCopying] = useState(false);
  
  const handleCopy = async () => {
    if (!onCopy) return;
    setIsCopying(true);
    try {
      await onCopy(collection);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="collection-card">
      {/* Collection content */}
      
      {showCopyButton && (
        <button
          onClick={handleCopy}
          disabled={isCopying}
          className="copy-collection-btn"
        >
          {isCopying ? 'Copying...' : 'Copy Collection'}
        </button>
      )}
    </div>
  );
};
```

### Phase 5: Subscription Management UI (Days 11-12)

#### Task 5.1: Collection Subscription Interface
Create subscription management components:
```typescript
// src/app/components/SubscriptionButton.tsx
interface SubscriptionButtonProps {
  collection: Collection;
  isSubscribed: boolean;
  onSubscribe: (collectionId: number) => Promise<void>;
  onUnsubscribe: (collectionId: number) => Promise<void>;
}

const SubscriptionButton = ({ collection, isSubscribed, onSubscribe, onUnsubscribe }: SubscriptionButtonProps) => {
  const [loading, setLoading] = useState(false);
  
  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isSubscribed) {
        await onUnsubscribe(collection.id);
      } else {
        await onSubscribe(collection.id);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`subscription-btn ${isSubscribed ? 'subscribed' : 'unsubscribed'}`}
    >
      {loading ? 'Loading...' : (isSubscribed ? 'Unsubscribe' : 'Subscribe')}
    </button>
  );
};
```

#### Task 5.2: Subscription Status Indicators
Add visual indicators for subscription status throughout the app:
- Collection cards show subscription badges
- Collection lists grouped by access type (owned/subscribed/public)
- Recipe cards show source collection subscription status

### Phase 6: Search & Filtering Updates (Day 13)

#### Task 6.1: Recipe Search Integration
Update RecipeSearch component to use household precedence:
```typescript
// src/app/components/RecipeSearch.tsx
const RecipeSearch = ({ onSearch, resultsCount, totalCount }: RecipeSearchProps) => {
  const { household_id } = useAuth();
  
  // Update to use searchRecipesWithPrecedence API
  const handleSearch = useCallback((searchTerm: string) => {
    const params = new URLSearchParams();
    params.set('q', searchTerm);
    params.set('household_id', household_id.toString());
    
    onSearch(`/api/recipes/search?${params.toString()}`);
  }, [household_id, onSearch]);

  // Component continues to work as before, but now with household context
};
```

#### Task 6.2: Meal Planning Integration
Update meal planning to use subscription-scoped recipe access:
```typescript
// src/app/plan/page.tsx - Meal planning page
export default function PlanPage() {
  const { household_id } = useAuth();
  
  useEffect(() => {
    // Use getMyRecipes() - strict subscription-based access
    fetch('/api/recipes/my-recipes')
      .then(res => res.json())
      .then(data => setAvailableRecipes(data));
  }, [household_id]);
  
  // Rest of meal planning logic remains the same
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