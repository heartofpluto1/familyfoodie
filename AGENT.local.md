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
- **PATTERN**: Create interface files in `/types/` for shared data structures
- **EXAMPLE**: `SessionData` interface for authentication state

## Security Patterns

### Authentication Flow
1. Server-side session validation in layout (`getSession()`)
2. Pass session data to header and page components
3. Conditional rendering based on server-side auth state
4. Client-side interactions use authenticated API routes
5. Logout via server-side route handler with cookie clearing

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

## Database Schema Reference

**IMPORTANT**: Always refer to `docs/schema.sql` for the complete database schema when working with:
- Database queries and SQL statements
- Understanding table relationships and foreign keys
- Adding new database-related functionality
- Troubleshooting data structure issues

The schema file contains the complete MySQL table structures, indexes, and constraints for all tables including:
- `auth_user` - Django user authentication
- `menus_recipe` - Recipe data with primaryType_id/secondaryType_id
- `menus_recipeingredient` - Recipe ingredients with quantities
- `menus_shoppinglist` - Shopping list items
- `menus_primarytype`/`menus_secondarytype` - Ingredient type categories
- And all other supporting tables