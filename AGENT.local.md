# AGENT.local.md

This file contains specific learnings and preferences for this Family Foodie codebase that Claude Code sessions should follow.

## Architecture Preferences (Updated 2025-01-10)

### Authentication & Security - Server-Side First
- **PREFER**: Server-side authentication using `getSession()` from `@/lib/session`
- **PREFER**: Server components with session data passed as props
- **AVOID**: Client-side auth contexts (`AuthProvider`) for new features
- **PATTERN**: Use `withAuth` HOC or direct `getSession()` calls in server components
- **LOGOUT**: Use route handlers (`/logout/route.ts`) that clear cookies and redirect, not client-side API calls

### Data Loading - Server-Side First  
- **PREFER**: Server-side data fetching in page components and server components
- **PREFER**: Database queries executed server-side before rendering
- **AVOID**: Client-side data fetching for initial page loads
- **PATTERN**: Fetch data in server components, pass to client components as props
- **EXAMPLE**: Home page uses server-side `getRecipeWeeks()` before rendering

### Client-Side Interactions
- **USE CLIENT-SIDE FOR**: PUT/POST API calls, form submissions, interactive state
- **PATTERN**: Client components handle user interactions, call APIs, update local state
- **EXAMPLE**: Shopping list drag/drop, add/remove items, purchase toggles

### Error Handling & User Feedback
- **PREFER**: `useToast()` from `@/app/components/ToastProvider` over `console.log`
- **AVOID**: Silent failures - always show user feedback for actions
- **PATTERN**: Use toast notifications for success/error states in client components
- **TYPES**: Import toast types from `@/types/toast` - `ToastData` (base) and `ToastMessage` (with id)

### Console Usage Guidelines
- **AVOID**: `console.error()` and `console.log()` in production code
- **CLIENT-SIDE**: Use `useToast()` hook for user-facing error feedback
- **SERVER-SIDE**: Use `addToast()` from `@/lib/toast` for debugging (lib files only)
- **API ROUTES**: Return actual error messages in JSON responses - NO console logging
- **ERROR PATTERN**: `error instanceof Error ? error.message : 'Fallback message'`
- **DEBUGGING**: Server-side toasts are preserved for development/debugging purposes

### Component Organization
- **ICONS**: Centralized in `@/app/components/Icons.tsx` with descriptive names (e.g., `ToastErrorIcon`, `IntroPlanIcon`)
- **IMPORTS**: Use absolute paths (`@/app/components/`) over relative paths (`../components/`)
- **STRUCTURE**: Group related components in feature directories (e.g., `/app/home/`, `/app/shop/components/`)

### Type Safety
- **PREFER**: Strict TypeScript types over `any`
- **AVOID**: Using `any[]` type - always define proper types for arrays
- **PATTERN**: Create interface files in `/types/` for shared data structures
- **EXAMPLE**: `SessionData` interface for authentication state
- **RULE**: No `any` types allowed, including `any[]` - use specific types or create interfaces

## Security Patterns

### Authentication Flow
1. Server-side session validation in layout (`getSession()`)
2. Pass session data to header and page components
3. Conditional rendering based on server-side auth state
4. Client-side interactions use authenticated API routes
5. Logout via server-side route handler with cookie clearing

### Authentication Helper Functions (Updated 2025-01-20)
- **`getAuthenticatedUser(request)`**: Takes NextRequest, extracts session, validates admin status
- **`getAuthenticatedUserFromSession(sessionData)`**: Takes decrypted session data, validates admin status  
- **`requireAdminUser(request)`**: Returns authenticated admin user or null
- **AVOID**: Function overloading - use separate named functions for clarity
- **SESSION STRUCTURE**: `{ user: AuthenticatedUser, loginTime: number }`

### Data Protection
- Sensitive data fetched server-side after auth verification
- No database queries in client components
- **ALL API routes MUST be protected using `withAuth` from `@/lib/auth-middleware`**
- API routes validate session before data access

## Development Patterns

### When to Use Server vs Client Components
- **Server**: Authentication checks, data fetching, static content
- **Client**: User interactions, form handling, state management, API calls
- **Hybrid**: Server component fetches data, passes to client component for interactivity

### Import Conventions
- Absolute imports: `@/app/components/`, `@/lib/`, `@/types/`
- Cross-feature imports should use absolute paths
- Same-level imports can remain relative (`./component`)

## Testing & Quality
- Run `npm run lint` and `npm run build` before completing tasks
- Use TypeScript strict mode - no `any` types
- Prefer server-side redirects (`redirect()`) over client-side navigation for auth flows

## Deployment & Environment Configuration

### Production Deployment - Google Cloud Run
- **DEPLOYMENT**: Automated via GitHub Actions (`.github/workflows/deploy.yml`)
- **HOSTING**: Google Cloud Run
- **CONTAINER REGISTRY**: Google Artifact Registry
- **AUTHENTICATION**: Workload Identity Federation (secure, no service account keys)

### Environment Variables - Production
- **CRITICAL**: All production environment variables MUST be stored as GitHub Secrets
- **REQUIRED SECRETS**: `SESSION_SECRET_KEY` and database connection variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_INSTANCE_UNIX_SOCKET`)
- **DEPLOYMENT**: Environment variables are injected via `--set-env-vars` in deployment step
- **SECURITY**: Never hardcode URLs, secrets, or connection strings in workflow files

### Database - Cloud SQL
- **CONNECTION**: Unix socket via Cloud SQL Proxy for production
- **INTEGRATION**: Connected to Cloud Run via `--add-cloudsql-instances` flag
- **FALLBACK**: TCP connection available for local development

### Common Production Issues
- **Next.js Link Prefetching**: Use `prefetch={false}` on logout links to prevent automatic route prefetching
- **Missing Environment**: Verify all required secrets are configured in GitHub repository settings  
- **Database Connection**: Check Cloud SQL instance connection in deployment configuration
- **Rate Limiting**: Progressive delays and IP blocking may affect login attempts in production

## Toast System Architecture

### Client-Side Toasts (Primary Usage)
- **ToastProvider.tsx**: Context provider wrapping the app, provides `useToast()` hook
- **ToastClient.tsx**: Individual toast component with animations and auto-dismiss
- **USAGE**: Extensively used in shop hooks and plan-client components for user feedback
- **PATTERN**: `const { showToast } = useToast(); showToast('success', 'Title', 'Message');`

### Server-Side Toasts (Debugging/Development)
- **lib/toast.ts**: Server-side toast queue using `addToast()`, `getPendingToasts()`, `clearPendingToasts()`
- **ToastServer.tsx**: Bridge component to display server-queued toasts on client
- **USAGE**: Currently dormant but preserved for debugging server-side operations
- **INTEGRATION**: Server components call `getPendingToasts()` and pass to `ToastServer` component

### Type System
- **types/toast.ts**: Shared type definitions - `ToastData` (base) and `ToastMessage` (with id)
- **CONSISTENCY**: All toast-related code uses centralized types from `@/types/toast`

## Development Notes
- **ToastServer.tsx**: Keep for debugging purposes - bridges server-side toast queue to client display

## Code Formatting - Prettier Configuration

**IMPORTANT**: This project uses a specific Prettier configuration that MUST be followed:

### Prettier Settings (.prettierrc)
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "tabWidth": 3,
  "useTabs": true,
  "printWidth": 160,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### Key Formatting Rules
- **INDENTATION**: Use TABS, not spaces (3-character tab width)
- **QUOTES**: Use SINGLE quotes for strings (not double quotes)
- **LINE LENGTH**: Maximum 160 characters per line
- **SEMICOLONS**: Always include semicolons at end of statements
- **TRAILING COMMAS**: Use ES5 style (commas in arrays/objects, not in function parameters)
- **ARROW FUNCTIONS**: Avoid parentheses for single parameters
- **BRACKET SPACING**: Include spaces inside object brackets `{ foo: 'bar' }`

### Common Mistakes to Avoid
- Using spaces instead of tabs for indentation
- Using double quotes instead of single quotes
- Breaking lines unnecessarily when under 160 characters
- Forgetting semicolons at statement ends
- Adding parentheses to single-parameter arrow functions

## Mobile-First Development Priority

**IMPORTANT**: This site is heavily used on mobile devices. Always prioritize mobile experience:
- Test and optimize all UI components for small screens (320px+)
- Use responsive typography (text-sm on mobile, larger on desktop)
- Implement touch-friendly navigation (larger touch targets, mobile menus)
- Hide non-essential elements on mobile to reduce clutter
- Consider mobile-first breakpoints: xs (475px), sm (640px), md (768px), lg (1024px)
- Navigation should collapse to a dropdown/select menu on small screens
- Always test layouts at mobile viewport sizes

## Admin System Architecture

### Admin Authentication & Authorization
- **ADMIN PROTECTION**: All admin functionality protected by `is_admin = true` database field
- **PAGE PROTECTION**: Use `withAdminAuth` HOC for admin pages (not regular `withAuth`)
- **API PROTECTION**: Use `requireAdminUser(request)` function in all admin API routes
- **REDIRECT BEHAVIOR**: Non-admin users redirected to `/` (home), not login page
- **SELF-PROTECTION**: Admins cannot delete themselves or modify their own privileges

### Admin Component Structure
- **`withAdminAuth`**: Server-side HOC that validates both authentication and admin status
- **`requireAdminUser`**: Helper function for API routes, returns AuthenticatedUser or null
- **AVOID**: Using regular `withAuth` for admin areas - it only checks authentication, not admin status

### Admin Navigation
- **HEADER INTEGRATION**: Admin link appears in navigation for users with `is_admin = true`
- **CONDITIONAL RENDERING**: `{user?.is_admin && <AdminLink />}` pattern for admin-only UI elements
- **RESPONSIVE**: Admin links included in both desktop and mobile navigation menus

### Admin API Routes Structure
```
/api/admin/users/ - User management (GET, POST, PATCH, DELETE)
/api/admin/users/[id]/ - Individual user operations  
/api/admin/migrate/ - Database migration management
```

### Admin Pages Structure
```
/admin/ - Dashboard with admin tool cards
/admin/users/ - User management interface
/admin/migrations/ - Migration status and controls
```

## Database Schema Reference

**IMPORTANT**: Always refer to `docs/schema.sql` for the complete database schema when working with:
- Database queries and SQL statements
- Understanding table relationships and foreign keys
- Adding new database-related functionality
- Troubleshooting data structure issues

### Recent Schema Changes (2025-01-20)
- **TABLE RENAME**: `auth_user` → `users` (completed via migration 003)
- **PERMISSION SIMPLIFICATION**: Removed `is_staff`, `is_superuser` → single `is_admin` boolean
- **MULTI-TENANT REMOVAL**: Removed all `account_id` references, system now shared for all users
- **USER_ID REMOVAL**: Removed `user_id` from menus/shopping tables - all data is now shared
- **LAST LOGIN TRACKING**: `last_login` field updated automatically on successful authentication

The schema file contains the complete MySQL table structures, indexes, and constraints for all tables including:
- `users` - User authentication and management (migrated from Django auth_user, simplified permissions)
- `menus_recipe` - Recipe data with primaryType_id/secondaryType_id (shared system)
- `menus_recipeingredient` - Recipe ingredients with quantities (shared system)
- `menus_shoppinglist` - Shopping list items (shared system)
- `menus_primarytype`/`menus_secondarytype` - Ingredient type categories
- And all other supporting tables

## Collections System Architecture (Updated 2025-01-21)

### Collection Management
- **COLLECTIONS TABLE**: Stores collection metadata (title, subtitle, filename, timestamps)
- **IMAGE STORAGE**: Collection images stored in `/public/collections/` directory
- **FILENAME STRATEGY**: Hash-based secure filenames for custom uploads, shared filename for defaults

### Default Image Strategy - Efficient Resource Management
- **DEFAULT IMAGES**: `custom_collection_004.jpg` and `custom_collection_004_dark.jpg` serve as shared defaults
- **NO FILE DUPLICATION**: When users don't upload custom images, store `filename = 'custom_collection_004'` in database
- **REFERENCE ONLY**: Multiple collections can reference the same default files without duplication
- **STORAGE EFFICIENCY**: Prevents hundreds of duplicate files when users use defaults

### Custom Image Handling
- **UNIQUE FILENAMES**: Generate secure hash-based filenames for user uploads using `generateCollectionSecureFilename()`
- **FILE FORMAT**: **JPG ONLY** - system enforces `.jpg` extension, all validation restricts to JPEG format
- **CUSTOM STORAGE**: User uploads saved as `{hash}.jpg` and `{hash}_dark.jpg` in collections directory

### Collection Deletion Logic
- **SAFE DELETION**: Delete logic checks `filename !== 'custom_collection_004'` before attempting file deletion
- **PROTECTED DEFAULTS**: Default image files are never deleted, even when last collection using them is removed
- **CUSTOM CLEANUP**: Only custom image files (with hashed filenames) are deleted with their collections

### Collection Form & Validation
- **OPTIONAL IMAGES**: Collection creation doesn't require image uploads (defaults used when none provided)
- **JPG ENFORCEMENT**: 
  - Frontend: `accept="image/jpeg,.jpg"` on file inputs
  - Validation: Strict MIME type and file extension checking
  - UI: Clear messaging "JPG files only (Max 10MB)"
- **DUAL UPLOAD**: Side-by-side light/dark mode image upload zones (300px × 410px)
- **PREVIEW INTEGRATION**: Image previews display as background images within upload zones

### Collection Image Display
- **THEME DETECTION**: Auto-detects user's light/dark mode preference using `MediaQueryList`
- **DYNAMIC LOADING**: Automatically switches between `filename.jpg` and `filename_dark.jpg` based on theme
- **CONSISTENT PATHS**: All images accessed via `/collections/{filename}.jpg` regardless of custom/default status

### Error Prevention Patterns
- **FILE TYPE SAFETY**: Multiple validation layers ensure only JPG files enter the system
- **FILENAME CONSISTENCY**: System expects `.jpg` extension, validation enforces it
- **DELETION PROTECTION**: Default files protected from accidental deletion during collection cleanup
- **RESOURCE EFFICIENCY**: Shared default files prevent storage waste when users don't customize

### Collections API Routes
```
POST /api/collections/create - Create collection (custom images or default reference)
DELETE /api/collections/delete - Delete collection (smart file cleanup)
```

### UI/UX Improvements Made
- **ENGAGING EMPTY STATES**: Replaced "No recipes found" with friendly, encouraging messages
- **CENTRALIZED ICONS**: All icons consolidated in `@/app/components/Icons.tsx`
- **RESPONSIVE CARDS**: Collection cards with hover effects (scale + rotation)
- **MOBILE-OPTIMIZED**: Touch-friendly interfaces with appropriate sizing

## Code Quality & Linting Standards (Updated 2025-08-20)

### TypeScript Type Safety Requirements
- **NO `any` TYPES**: Strict enforcement - never use `any` or `any[]` 
- **EXPLICIT TYPING**: Always define proper interfaces and types
- **DATABASE QUERY RESULTS**: Cast database results to proper types (e.g., `Array<{ filename: string }>`)
- **PARAMETER ARRAYS**: Use union types for SQL parameters (e.g., `(string | number)[]`)
- **IMPORT TYPES**: Import types from appropriate modules (`Collection` from `@/lib/queries/collections`)

### Unused Code Elimination
- **REMOVE UNUSED IMPORTS**: Delete imports that aren't used in the file
- **REMOVE UNUSED VARIABLES**: Delete defined variables/functions that aren't referenced
- **CLEAN UP DEAD CODE**: Remove commented-out code and unused helper functions

### Formatting Standards (Prettier Integration)
- **AUTO-FIX FIRST**: Always run `npm run lint:fix` before manual fixes
- **CONSISTENT INDENTATION**: Tabs with 3-character width (enforced by Prettier)
- **LINE LENGTH**: 160 character maximum (enforced by Prettier)
- **OBJECT FORMATTING**: Multi-line object properties get proper indentation

### Lint Error Patterns Encountered
1. **Type Casting Issues**: Database query results often returned as `any[]` - cast to proper interfaces
2. **Import Cleanup**: Unused imports like `HeaderPage` commonly left behind during refactoring
3. **Function Cleanup**: Helper functions like `getTitle()` defined but not used after component changes
4. **Parameter Typing**: SQL parameter arrays frequently typed as `any[]` instead of proper union types

### Development Workflow
- **BEFORE COMMITTING**: Always run `npm run lint` and fix all errors
- **BUILD VERIFICATION**: Run `npm run build` to catch TypeScript errors not caught by lint
- **PROGRESSIVE FIXING**: Use `npm run lint:fix` for auto-fixable issues, then manually address remaining errors

## User Confirmation Dialogs - ConfirmDialog Component (Updated 2025-08-21)

### Browser Dialog Replacement Strategy
- **AVOID**: Native browser `confirm()` and `alert()` dialogs - they provide poor UX and mobile compatibility
- **PREFER**: `ConfirmDialog` component from `@/app/components/ConfirmDialog` for all confirmation needs
- **CONSISTENCY**: All destructive actions should use the same confirmation pattern across the application

### ConfirmDialog Implementation Pattern

#### For React Components
```tsx
// State management for confirmation dialog
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [itemToDelete, setItemToDelete] = useState<ItemType | null>(null);
const [isDeleting, setIsDeleting] = useState(false);

// Click handler to show confirmation
const handleDeleteClick = (item: ItemType) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
};

// Confirmation handler
const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
        await deleteAction(itemToDelete.id);
        setShowDeleteConfirm(false);
        setItemToDelete(null);
        // Handle success
    } catch (error) {
        // Handle error
    } finally {
        setIsDeleting(false);
    }
};

// Cancel handler
const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setItemToDelete(null);
};

// JSX
<ConfirmDialog
    isOpen={showDeleteConfirm}
    title="Delete Item"
    message="Are you sure you want to delete this item? This action cannot be undone."
    confirmText="Delete Item"
    cancelText="Cancel"
    onConfirm={handleDeleteConfirm}
    onCancel={handleDeleteCancel}
    isLoading={isDeleting}
/>
```

#### For Custom Hooks
- **RETURN CONFIRMATION STATE**: Instead of directly showing confirm(), return state for parent components to manage
- **PATTERN**: Export click handlers, confirm handlers, cancel handlers, and confirmation state
- **EXAMPLE**: `useShoppingList` hook returns `resetListClick`, `resetListConfirm`, `resetListCancel`, `showResetConfirm`

#### Parent Component Integration
- **HOOK CONSUMERS**: Components using modified hooks must handle confirmation state and render ConfirmDialog
- **STATE PASSING**: Updated context providers to pass through new confirmation methods
- **IMPORT REQUIREMENT**: All components using confirmation need `import ConfirmDialog from '@/app/components/ConfirmDialog'`

### Benefits of ConfirmDialog Approach
- **CONSISTENT UX**: Unified styling and behavior across all confirmations
- **MOBILE-FRIENDLY**: Better touch interaction and accessibility than browser dialogs
- **CUSTOMIZABLE**: Support for loading states, custom messages, and themed styling
- **ACCESSIBLE**: Proper ARIA attributes and keyboard navigation support
- **NON-BLOCKING**: Integrates with React state management and doesn't block JavaScript execution

### Completed Replacements (2025-08-21)
1. **Admin User Deletion** (`src/app/admin/users/users-client.tsx`) - Browser confirm() → ConfirmDialog
2. **Admin Migration Execution** (`src/app/admin/migrations/migrations-client.tsx`) - Browser confirm() → ConfirmDialog  
3. **Shopping List Reset** (`src/app/shop/hooks/useShoppingList.ts` + context) - Browser confirm() → ConfirmDialog
4. **Recipe Ingredient Deletion** (`src/app/recipes/[collection-slug]/[recipe-slug]/hooks/useIngredientApi.ts`) - Browser confirm() → ConfirmDialog
5. **Ingredient Management Deletion** (`src/app/ingredients/hooks/useIngredientEdit.ts`) - Browser confirm() → ConfirmDialog

### Search Pattern for Future Work
- **DETECTION**: Use `Grep` tool to search for `confirm\\(` patterns to find remaining browser dialogs
- **PRIORITY**: Replace any remaining confirm() dialogs with ConfirmDialog component using the established patterns above

## Dark Mode Images - Native HTML Picture Element (Updated 2025-08-21)

### Problem Solved
The original implementation used JavaScript to detect dark mode and swap image URLs client-side, causing visible flashing when images reloaded from light to dark mode URLs.

### Solution: Native HTML Picture Element
Replace JavaScript theme detection with native HTML `<picture>` element using `prefers-color-scheme` media queries.

### Implementation Pattern
```html
<picture className="absolute inset-0 w-full h-full">
	<source srcSet={coverImage.replace(/(\.[^.]+)$/, '_dark$1')} media="(prefers-color-scheme: dark)" />
	<source srcSet={coverImage} media="(prefers-color-scheme: light)" />
	<img src={coverImage} alt="Collection cover" className="w-full h-full object-cover" />
</picture>
```

### Benefits Achieved
- **No Image Flashing**: Browser natively chooses correct image immediately based on system preference
- **Better Performance**: Only downloads the needed image, no JavaScript execution required
- **Simpler Codebase**: Eliminates JavaScript theme detection logic (~15 lines removed)
- **Future-Proof**: Uses web standards, works with SSR/SSG out of the box
- **SEO Friendly**: Works without JavaScript enabled

### Files Updated (2025-08-21)
1. **CollectionCard.tsx**: Replaced `backgroundImage` style with native `<picture>` element
2. **collections-client.tsx**: Removed `useState`, `useEffect`, and `getImageForTheme` logic

### Usage Guidelines
- **FOR NEW FEATURES**: Use native HTML `<picture>` element for any dark mode image switching
- **AVOID**: JavaScript-based theme detection for images (`window.matchMedia`, `useEffect` theme detection)
- **PATTERN**: Always provide both light and dark image sources with `prefers-color-scheme` media queries

## Button Styling - btn-default Class Usage (Updated 2025-08-21)

### Unified Button Styling Strategy
- **PREFER**: Use `btn-default` CSS class for all buttons with gray background styling
- **AVOID**: Individual Tailwind utility classes for basic button styling (`bg-gray-*`, `hover:bg-gray-*`, `dark:bg-gray-*`)
- **CONSISTENCY**: All gray-styled buttons across the site should use the same btn-default class

### btn-default Class Definition
Located in `src/app/globals.css`:
```css
.btn-default {
	background-color: #d1d5dc;
	color: black;
	&:hover {
		background-color: #9ca3af;
	}
}

@media (prefers-color-scheme: dark) {
	.btn-default {
		background-color: #374151;
		color: white;
		&:hover {
			background-color: #4b5563;
		}
	}
}
```

### Button Class Replacement Pattern
**REPLACE THIS:**
```tsx
className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
```

**WITH THIS:**
```tsx
className="btn-default px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50"
```

### Key Changes Made
- **REMOVED**: All `bg-gray-*`, `hover:bg-gray-*`, `dark:bg-gray-*`, and `text-white`/`text-gray-*` color utility classes
- **REMOVED**: `transition-colors` class (handled by CSS)
- **PRESERVED**: Spacing (`px-*`, `py-*`), border radius (`rounded`), typography (`text-sm`, `font-medium`), and state classes (`disabled:opacity-50`)

### Files Unified (2025-08-21)
1. **ConfirmDialog.tsx**: Cancel button in main confirm dialog
2. **collection-add-client.tsx**: Cancel button in collection creation
3. **RecipePreviewSection.tsx**: Cancel button in recipe preview
4. **PdfUpload.tsx**: Small cancel button for PDF uploads
5. **RecipeEditor.tsx**: Cancel button in recipe editing
6. **ai-recipe-import-client.tsx**: "Try Another PDF" button
7. **ImageUploadWithCrop.tsx**: Cancel button in image crop dialog
8. **ImageUpload.tsx**: Cancel/Remove button in image upload
9. **plan/ConfirmDialog.tsx**: Cancel button in plan confirm dialog
10. **AddWeekButton.tsx**: Add week button in meal planning
11. **AddRecipeCard.tsx**: Circular add button for recipes
12. **shop-client.tsx**: Reset list buttons (2 instances)
13. **EditControls.tsx**: All control buttons (7 instances)
14. **PdfUploadSection.tsx**: Choose file button

### Benefits of btn-default Approach
- **DESIGN CONSISTENCY**: Uniform appearance across all gray buttons site-wide
- **MAINTENANCE**: Single source of truth for button styling in CSS
- **THEME SUPPORT**: Automatic light/dark mode handling via CSS media queries
- **REDUCED BUNDLE**: Fewer utility classes, cleaner HTML output
- **FUTURE-PROOF**: Easy to modify button styling globally by updating CSS class

### Development Guidelines
- **FOR NEW BUTTONS**: Use `btn-default` class for any button that would use gray background
- **SEARCH PATTERN**: Use `Grep` tool to find `bg-gray` patterns when adding new features
- **CSS LOCATION**: Button styles are centralized in `src/app/globals.css`
- **TESTING**: Always run `npm run lint` after button style changes to ensure formatting compliance

## API Route Testing Standards (Updated 2025-08-24)

### Testing Infrastructure Overview
The codebase has comprehensive API route testing using Jest with `next-test-api-route-handler` for consistent API testing patterns.

### Testing Quality Standards

#### Test Structure & Organization
- **ENVIRONMENT**: All tests use `/** @jest-environment node */` for API route testing
- **NAMING CONVENTION**: Tests follow `route.test.ts` pattern alongside `route.ts` files
- **DESCRIBE BLOCKS**: Organized by HTTP method (e.g., `describe('PUT /api/recipe/ingredients')`)
- **TEST CASES**: Comprehensive coverage including success, validation, error, and edge cases

#### Authentication Testing Patterns
- **STANDARD MOCKS**: Uses `@/lib/test-utils` for consistent auth mocking
- **AUTH MIDDLEWARE**: Mocked via `authMiddlewareMock` for regular routes, `passthroughAuthMock` for admin routes
- **USER SCENARIOS**: Tests both authenticated (`mockAuthenticatedUser`) and unauthenticated (`mockNonAuthenticatedUser`) cases
- **ADMIN TESTING**: Admin routes use `requireAdminUser` with proper privilege validation

#### Database Testing Patterns
- **DATABASE MOCKING**: Comprehensive mocking of `@/lib/db.js` with `mockExecute` and `mockGetConnection`
- **TRANSACTION TESTING**: Proper mocking of database transactions with `MockConnection` interface
- **RESULT FORMATS**: Consistent MySQL2 result format `[rows, fields]` in mock responses
- **ERROR SCENARIOS**: Uses `standardErrorScenarios` for consistent database error testing

#### Validation Testing Excellence
- **INPUT VALIDATION**: Thorough testing of missing fields, invalid types, and boundary conditions
- **HTTP STATUS CODES**: Proper use of 400 (validation), 401 (auth), 404 (not found), 409 (conflict), 500 (server error)
- **ERROR RESPONSE FORMAT**: Consistent error response structure with descriptive messages and error codes
- **EDGE CASES**: Tests handle zero values, negative numbers, empty strings, special characters, and oversized inputs

#### File Upload Testing (Outstanding Quality)
- **MOCK FILE CREATION**: `createMockFile()` utility with proper MIME type magic bytes
- **FILE TYPE VALIDATION**: Tests for supported formats (JPEG, PNG, WebP, PDF) with detailed error responses
- **SIZE VALIDATION**: File size limits tested with descriptive error messages
- **CONVERSION TESTING**: JPG→PDF conversion testing with jsPDF mocking and orientation detection
- **FILE CLEANUP**: Tests for versioned filename generation and cleanup of old files

### Available Testing Utilities (`@/lib/test-utils`)

#### Mock Users & Authentication
- **`mockAdminUser`**: Standard admin user for testing admin functionality
- **`mockRegularUser`**: Standard regular user for testing normal user functionality
- **`mockAuthenticatedUser(req)`**: Request patcher for authenticated requests
- **`mockNonAuthenticatedUser(req)`**: Request patcher for unauthenticated requests

#### Database Mocking
- **`MockConnection`**: TypeScript interface for database connection mocking
- **`clearAllMocks()`**: Standard cleanup function for `beforeEach` blocks
- **`enhancedTestData`**: Comprehensive test data scenarios for recipes, ingredients, and database results

#### File Testing Utilities
- **`createMockFile(name, type, size, content?)`**: Creates mock File objects with proper magic bytes
- **Supported MIME Types**: Handles JPEG, PNG, WebP with appropriate file signatures
- **Custom Content**: Allows injection of specific content for corruption testing

#### Console & Error Mocking
- **`setupConsoleMocks()`**: Standardized console mocking with cleanup function
- **`standardErrorScenarios`**: Pre-defined error objects for consistent testing
- **Error Types**: Database, auth, validation, storage, and not found errors

#### Authentication Middleware Mocking
- **`authMiddlewareMock`**: Standard auth middleware for regular routes
- **`passthroughAuthMock`**: Passthrough middleware for admin routes with custom auth handling

### Test Execution Commands
- **`npm test`**: Run all tests
- **`npm run test:watch`**: Run tests in watch mode
- **`npm run test:coverage`**: Generate coverage reports (HTML, LCOV, JSON)

### Testing Best Practices Established

#### Test Organization
1. **Consistent Structure**: All tests follow the same organizational pattern with clear describe blocks
2. **Comprehensive Coverage**: Each test file covers all HTTP methods, success cases, validation errors, and edge cases
3. **Mock Management**: Proper setup/teardown in `beforeEach`/`afterAll` with console mock cleanup

#### Error Testing Excellence
1. **Detailed Error Messages**: Tests verify specific error messages, not just status codes
2. **Error Response Structure**: Consistent validation of error response format with codes and messages
3. **User-Friendly Messaging**: Error responses include helpful suggestions and context

#### Database Testing Sophistication
1. **Transaction Testing**: Proper mocking of database transactions with rollback scenarios
2. **Concurrent Request Handling**: Advanced testing of race conditions and concurrent operations
3. **Foreign Key Validation**: Testing of database constraint violations and referential integrity

#### File Handling Excellence
1. **MIME Type Validation**: Comprehensive testing of file type validation with magic byte verification
2. **File Versioning**: Testing of versioned filename generation and cleanup of old files
3. **Conversion Testing**: Complex testing of image-to-PDF conversion with orientation handling

### Recommendations for New Tests

#### When Adding New API Route Tests
1. **USE EXISTING PATTERNS**: Follow the established patterns from existing test files
2. **IMPORT STANDARD UTILITIES**: Always use `@/lib/test-utils` for consistent mocking
3. **COMPREHENSIVE COVERAGE**: Include success, validation, auth, error, and edge case scenarios
4. **TRANSACTION TESTING**: For routes that modify data, test database transaction rollback scenarios
5. **CONSOLE MOCKING**: Always use `setupConsoleMocks()` and clean up in `afterAll`

#### Test Quality Checklist
- [ ] Uses `/** @jest-environment node */`
- [ ] Imports and uses `@/lib/test-utils` utilities
- [ ] Tests all HTTP methods supported by the route
- [ ] Includes authentication testing (both auth and non-auth cases)
- [ ] Tests input validation with various invalid scenarios
- [ ] Tests error handling with proper status codes and messages
- [ ] Includes edge cases and boundary conditions
- [ ] Uses consistent mock cleanup in `beforeEach` and `afterAll`
- [ ] Verifies database calls with proper parameters
- [ ] Tests transaction rollback scenarios where applicable

