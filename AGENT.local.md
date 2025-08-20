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