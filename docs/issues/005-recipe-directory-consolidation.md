# 005: Recipe Directory Consolidation

## Issue Description

The Family Foodie application currently has recipe operations split across two separate directories:

- `/app/recipe/` - Contains global recipe listing and AI recipe import functionality
- `/app/recipes/` - Contains collection-based recipe browsing and individual recipe management

This split structure creates several problems:

### Problems with Current Structure

1. **Confusing Navigation**: Users encounter `/recipe/import` which doesn't provide collection context, requiring them to select a collection during the import process
2. **Redundant Recipe Listing**: The global recipe list in `/app/recipe/` has been superseded by the collection-based approach in `/app/recipes/`
3. **Inefficient AI Processing**: OpenAI is asked to suggest collections and populate a dropdown, adding unnecessary API costs and processing time
4. **Inconsistent UX**: Import workflow is disconnected from the collection context where users are already browsing
5. **Code Maintenance**: Recipe-related code is scattered across two directory structures

### Current Import Flow Issues

- User browses collections → selects collection → clicks import → gets redirected to global import page → must re-select the same collection
- OpenAI processes images and suggests collection (often incorrectly) → user must manually correct collection choice
- Import process lacks collection context that user already established

## Proposed Solution

### Consolidate Recipe Operations Under `/app/recipes/`

**Move Import to Collection Context:**
- Move `/app/recipe/import/` → `/app/recipes/[collection-slug]/import/`
- Import becomes collection-aware: `/recipes/family-favorites-2/import`
- Collection is pre-selected from URL slug - no collection dropdown needed

**Simplify AI Processing:**
- Remove OpenAI collection suggestion logic from AI preview API
- Remove collection selection from import interface
- Focus AI processing on recipe extraction and ingredient matching

**Delete Redundant Functionality:**
- Remove global recipe listing (`/app/recipe/page.tsx`, `recipes-client.tsx`)
- Delete unused database queries for global recipe display
- Clean up navigation references to old import path

### Benefits of Consolidation

1. **Better UX**: Users import directly into the collection they're browsing
2. **Reduced AI Costs**: No more collection suggestion processing in OpenAI
3. **Cleaner Codebase**: All recipe operations under single directory structure  
4. **Logical Navigation**: Import button appears in collection context where it belongs
5. **Consistent Architecture**: Matches collection-first approach used throughout app

### Implementation Phases

1. **Move Import Functionality**: Relocate all import code to collection-specific directory
2. **Update Collection Integration**: Modify import to accept collection from URL slug
3. **Simplify AI Processing**: Remove collection selection from OpenAI workflow
4. **Update Navigation**: Fix import button links and references
5. **Clean Up**: Delete obsolete global recipe listing functionality

### Technical Changes Required

**File Movements:**
- `/app/recipe/import/` → `/app/recipes/[collection-slug]/import/`
- `/app/recipe/components/` → `/app/recipes/components/` (merge)
- `/app/recipe/hooks/` → `/app/recipes/hooks/` (merge)
- `/app/recipe/types/` → `/app/recipes/types/` (merge)

**API Updates:**
- Remove collection fetching from `/api/recipe/ai-preview/route.ts`
- Remove OpenAI collection suggestion prompt (lines 118-181)
- Simplify preview response structure

**Component Updates:**
- Update `useAiImport` hook to work with pre-selected collection
- Remove collection selection UI from import components
- Update import page to extract collection from route params

**Navigation Updates:**
- Update import button in `RecipeList.tsx` (line 65)
- Remove hardcoded `/recipe/import` references

**Database Query Cleanup:**
- Remove `getAllRecipesWithDetails()` usage for global listing
- Keep collection-specific recipe queries

### Risk Assessment

**Low Risk:**
- Moving self-contained import functionality
- Deleting superseded global recipe listing
- Updating import path references

**Medium Risk:**
- Modifying AI preview API (complex OpenAI integration)
- Updating central import hook logic

**Mitigation Strategies:**
- Test import workflow thoroughly after each phase
- Preserve API route structure for stability
- Maintain collection selection fallback during transition

## Expected Outcome

After consolidation:
- All recipe operations consolidated under `/app/recipes/`
- Import workflow integrated with collection browsing context
- Simplified AI processing focused on recipe extraction
- Cleaner, more maintainable codebase
- Better user experience with logical navigation flow