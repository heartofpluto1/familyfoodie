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

## Development Notes
- **ToastServer.tsx**: Keep for debugging purposes - used by developer for testing toast messages