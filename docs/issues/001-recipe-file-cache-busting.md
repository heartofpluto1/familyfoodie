# Recipe File Caching and Versioning Issue

## Problem Description

### Current State
The application currently stores recipe files (images and PDFs) using a single database column:
- `recipes.filename` (VARCHAR 64) - stores base filename without extension
- File extensions are added programmatically when serving files (.jpg for images, .pdf for PDFs)
- Same base filename is used for both image and PDF files

### The Caching Problem
When users update recipe images or PDFs through the edit modals:
1. New file is uploaded and overwrites the existing file with same filename
2. Database reports "update successful" 
3. Browser cache still serves the old file content
4. Users see stale images/PDFs despite successful upload
5. Hard refresh or cache clearing is required to see updated content

### Additional Limitations
1. **File Format Restriction**: Only supports JPG images because extension is hardcoded
2. **Extension Guessing**: System assumes .jpg for images and .pdf for PDFs
3. **No Version Tracking**: No way to track file update history
4. **Cache Busting**: No mechanism to force browser cache invalidation

## Root Causes

### 1. Static Filename Strategy
```sql
-- Current approach
filename = "abc123def456..." (64-char hash)
-- File URLs become:
-- /static/abc123def456...jpg 
-- /static/abc123def456...pdf
```
When files are updated, URLs remain identical, causing browser caching issues.

### 2. Single Column for Multiple File Types
The `filename` column serves both image and PDF files, preventing:
- Different versioning strategies per file type
- Support for multiple image formats
- Independent file updates

### 3. Extension Hardcoding
```typescript
// Current utility functions
getRecipeImageUrl(filename) // Always adds .jpg
getRecipePdfUrl(filename)   // Always adds .pdf
```

## Proposed Solution

### Database Schema Changes
Replace single `filename` column with separate versioned columns:

```sql
-- New schema
ALTER TABLE recipes 
ADD COLUMN image_filename VARCHAR(100),  -- e.g., "abc123def456.jpg", "abc123def456_v2.png"
ADD COLUMN pdf_filename VARCHAR(100);    -- e.g., "abc123def456.pdf", "abc123def456_v2.pdf"

-- Migration
UPDATE recipes SET 
  image_filename = CONCAT(filename, '.jpg'),
  pdf_filename = CONCAT(filename, '.pdf');

DROP COLUMN filename;
```

### File Naming Convention
```
{64-character-hash}[{version-suffix}].{extension}

Examples:
- abc123def456789.jpg           (v1 image)
- abc123def456789_v2.png        (v2 image, different format)
- abc123def456789.pdf           (v1 PDF)
- abc123def456789_v3.pdf        (v3 PDF)
```

### Benefits
1. **Cache Busting**: Versioned filenames force browser cache invalidation
2. **Format Flexibility**: Support JPG, PNG, WebP for images
3. **Separate Versioning**: Images and PDFs can be updated independently
4. **Complete Filename Storage**: No more extension guessing
5. **Version History**: Track update iterations

### Implementation Areas
1. Database migration
2. TypeScript interface updates
3. API route modifications (upload/update endpoints)
4. Utility function updates
5. Component updates throughout the application
6. File storage handling

## Impact Assessment

### Files Requiring Updates
- Database: `migrations/015_add_versioned_file_columns.sql`
- Types: `src/types/menus.ts` (4 interfaces)
- Queries: `src/lib/queries/menus.ts`, `src/lib/queries/insights.ts`
- APIs: Upload and update routes (5+ files)
- Utils: `src/lib/utils/secureFilename.ts`
- Components: Recipe cards, editors, forms (10+ files)

### Risk Level: **High**
- Breaking changes to core data structures
- Affects entire recipe display and editing flow
- Requires coordinated deployment of database + application changes

## Success Criteria
1. Users can upload JPG, PNG, and WebP images
2. File updates immediately display new content (no cache issues)
3. Image and PDF files can be versioned independently
4. All existing recipes continue to work after migration
5. No data loss during transition