# Collection Edit Feature Specification

## Overview
This specification outlines the implementation plan for adding Collection Edit capability to the meal planning application. The feature will allow users to edit their existing collections, including updating titles, subtitles, images, and overlay settings.

## Goals
- Enable users to edit collections they own
- Maximize code reuse between create and edit functionality
- Maintain data integrity and prevent orphaned files
- Follow existing codebase patterns and conventions

## Technical Architecture

### API Strategy
Create a **separate update endpoint** `/api/collections/update/route.ts` rather than modifying the existing create endpoint.

**Reasoning:**
- Follows existing codebase patterns (recipes have separate update endpoints like `/api/recipe/update-details`, `/api/recipe/update-image`)
- Cleaner separation of concerns
- Easier to maintain and test
- Better security with different permission checks
- Simpler error handling and validation logic

### Component Architecture
Refactor the existing collection-add form into a reusable component that handles both create and edit modes.

**Approach:**
1. Extract core form logic from `collection-add-client.tsx` into a new `CollectionForm.tsx` component
2. Add mode prop: `'create' | 'edit'`
3. Add optional collection prop for edit mode with existing data
4. Conditionally handle form submission based on mode

## Implementation Plan

### Phase 1: Backend API Endpoint

#### 1.1 Create Update Endpoint
**File:** `/src/app/api/collections/update/route.ts`

```typescript
export async function PUT(request: Request): Promise<NextResponse> {
  // Features to implement:
  - Authentication and authorization checks
  - Validate collection ownership
  - Handle partial updates (only update provided fields)
  - Image replacement logic with orphan checking
  - URL slug regeneration if title changes
  - Transaction support for atomic updates
}
```

#### 1.2 Image Handling Strategy
Based on the recipe update-image pattern (lines 149-174 of `/api/recipe/update-image/route.ts`):

1. **Before deleting old images:**
   ```sql
   SELECT COUNT(*) FROM collections 
   WHERE (filename = ? OR filename_dark = ?) 
   AND id != ?
   ```
   
2. **Only delete if count is 0** (image is orphaned)
3. Support three scenarios:
   - Keep existing images (no new files provided)
   - Replace one or both images
   - Revert to default images

#### 1.3 Database Updates
- Update collection fields: `title`, `subtitle`, `show_overlay`
- Conditionally update: `filename`, `filename_dark`
- Regenerate `url_slug` if title changes
- Update `updated_at` timestamp

### Phase 2: Shared Form Component

#### 2.1 Refactor Collection Form
**New File:** `/src/app/recipes/components/CollectionForm.tsx`

```typescript
interface CollectionFormProps {
  mode: 'create' | 'edit';
  collection?: Collection; // For edit mode
  onSuccess?: (collection: Collection) => void;
  onCancel?: () => void;
}
```

**Key Features:**
- Load existing data in edit mode
- Show current images as previews
- Allow image replacement or keeping existing
- Conditional submit button text ("Create" vs "Update")
- Different API endpoints based on mode

#### 2.2 Image Preview Handling
In edit mode:
- Display existing images from storage URLs
- Show "Replace image" UI when no new file selected
- Preview new images when files are selected
- Option to revert to default images

### Phase 3: Edit Page Implementation

#### 3.1 Create Edit Page
**File:** `/src/app/recipes/collection-edit/[id]/page.tsx`

```typescript
// Server component that:
1. Validates user session
2. Fetches collection by ID
3. Verifies ownership (access_type === 'owned')
4. Passes data to CollectionForm in edit mode
```

#### 3.2 Client Component
**File:** `/src/app/recipes/collection-edit/[id]/collection-edit-client.tsx`

```typescript
// Wrapper that uses CollectionForm with:
- mode="edit"
- Existing collection data
- Success redirect to collection page
- Cancel navigation back
```

### Phase 4: UI Integration

#### 4.1 Enable Edit Button
**File:** `/src/app/recipes/[collection-slug]/collection-client.tsx`

Uncomment and implement the edit button (currently at lines 176-186):
```typescript
<button
  onClick={() => router.push(`/recipes/collection-edit/${selectedCollection.id}`)}
  className="btn-default inline-flex items-center justify-center w-10 h-10 rounded-full"
  title="Edit Collection"
>
  <EditIcon className="w-4 h-4" />
</button>
```

#### 4.2 Permission Checks
- Only show edit button for `access_type === 'owned'`
- Server-side validation in API endpoint
- Redirect unauthorized users

### Phase 5: Testing Strategy

#### 5.1 API Tests
**File:** `/src/app/api/collections/update/route.test.ts`

Test scenarios:
- Valid updates with all fields
- Partial updates
- Image replacement
- Orphan detection
- Permission validation
- Invalid collection IDs
- Non-owned collections

#### 5.2 Component Tests
- Form field updates
- Image upload/preview
- Mode switching
- Error handling
- Success callbacks

#### 5.3 Integration Tests
- Full edit flow
- Image cleanup verification
- URL slug updates
- Navigation flows

## Security Considerations

### Authorization
- Only collection owners can edit (check `access_type === 'owned'`)
- Validate `household_id` matches session
- Server-side permission checks in API

### File Security
- Validate image file types and sizes
- Check for orphaned files before deletion
- Use transactions for atomic updates
- Sanitize filenames

### Data Validation
- Required fields: `collection_id`, `title`
- Optional fields: `subtitle`, `showOverlay`, images
- Validate file MIME types match extensions
- Maximum file size limits (5MB)

## Migration Considerations

### Database Changes
No database schema changes required - existing fields support edit functionality.

### Backward Compatibility
- Maintain existing create endpoint
- No breaking changes to existing collections
- Gradual rollout possible

## Future Enhancements

### Phase 6 (Optional)
1. **Bulk edit operations** - Edit multiple collections
2. **Image cropping** - Like recipe image editor
3. **Collection templates** - Save/apply common settings
4. **Version history** - Track collection changes
5. **Collaborative editing** - For shared households

## Success Metrics
- Users can successfully edit their collections
- No orphaned images in storage
- Zero data loss during updates
- Performance comparable to create operation
- Intuitive UX with clear feedback

## Risk Mitigation

### Risks and Mitigations
1. **Risk:** Accidental deletion of images used by other collections
   **Mitigation:** Orphan checking before deletion

2. **Risk:** Failed partial updates leaving inconsistent state
   **Mitigation:** Database transactions, rollback on failure

3. **Risk:** Users losing unsaved changes
   **Mitigation:** Confirmation dialogs, auto-save drafts

4. **Risk:** Performance issues with large images
   **Mitigation:** Client-side compression, progress indicators

## Estimated Timeline
- Phase 1 (API): 2-3 hours
- Phase 2 (Form refactor): 3-4 hours  
- Phase 3 (Edit page): 1-2 hours
- Phase 4 (UI integration): 1 hour
- Phase 5 (Testing): 2-3 hours

**Total estimate: 9-13 hours**

## Conclusion
This implementation plan provides a robust, maintainable solution for collection editing that follows existing patterns in the codebase while preventing common issues like orphaned files. The phased approach allows for incremental development and testing.