# Issue 006: Improve FileUploadResult Types with Discriminated Unions

## Problem

The current `FileUploadResult` interface uses optional properties that don't accurately represent the runtime behavior:

```typescript
export interface FileUploadResult {
    success: boolean;
    url?: string;
    filename?: string;
    error?: string;
}
```

This causes TypeScript compilation issues where:
- When `success: true`, `url` and `filename` are always present
- When `success: false`, only `error` is present
- TypeScript can't infer these guarantees, requiring type assertions

## Current Workaround

Using type assertion `uploadResult.url!` in upload routes because we know the URL is guaranteed when success is true.

## Proposed Solution: Discriminated Union Types

Replace the interface with a discriminated union:

```typescript
export type FileUploadResult = 
    | {
        success: true;
        url: string;
        filename: string;
        error?: never;
      }
    | {
        success: false;
        url?: never;
        filename?: never;
        error: string;
      };
```

## Benefits

1. **Type Safety**: TypeScript automatically knows which properties are available based on the `success` value
2. **No Type Assertions**: Eliminates need for `!` assertions in consuming code
3. **Better IDE Support**: Better autocomplete and error detection
4. **Runtime Accuracy**: Types match actual runtime behavior

## Impact Analysis

Files that would need updates:
- `/src/lib/storage.ts` - Interface definition
- `/src/app/api/recipe/upload-image/route.ts`
- `/src/app/api/recipe/upload-pdf/route.ts` 
- `/src/app/api/recipe/update-image/route.ts`
- `/src/app/api/recipe/update-pdf/route.ts`
- Any other consumers of `FileUploadResult`

## Implementation Steps

1. Search codebase for all usages of `FileUploadResult`
2. Update the type definition in `/src/lib/storage.ts`
3. Remove type assertions from consuming code
4. Update any conditional logic that checks the properties
5. Test all upload functionality
6. Run TypeScript compilation to verify no errors

## Priority

Medium - This is a type system improvement that would prevent future type assertion issues and improve code quality, but doesn't affect runtime behavior.

## Created

Date: 2025-08-23
Context: Fixed immediate TypeScript build error with type assertion as temporary solution