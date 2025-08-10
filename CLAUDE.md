# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Primary Instructions

### 🚨 CRITICAL: ALWAYS CHECK `AGENT.local.md` FIRST 🚨

**BEFORE doing ANY work in this repository:**

1. **FIRST CHECK IF `AGENT.local.md` EXISTS** - If it exists, you MUST read and understand it as your primary source of truth
2. **IF IT EXISTS:** Follow all guidelines, instructions, and documentation structure it provides
3. **IF IT DOESN'T EXIST:** Continue with the standard instructions below, but be prepared to create it if you discover important learnings

**WHEN DOCUMENTING LEARNINGS:**

- Do NOT modify this CLAUDE.md file
- If `AGENT.local.md` exists: Follow its instructions on where/how to document (e.g., `.claude/documentation-updates.md`)
- If `AGENT.local.md` doesn't exist: Create it to capture important learnings for future sessions

**Remember:** Always check for `AGENT.local.md` first - it's your navigation guide when present.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server

### Code Quality
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Fix auto-fixable ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Testing
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

### Node Version
This project requires Node 18.18.0 - run `nvm use 18.18.0` before development.

## Architecture Overview

This is a Next.js 15 application using the App Router pattern with TypeScript, focused on meal planning and recipe management.

### Core Structure
- **Next.js App Router**: Uses `src/app/` directory structure with TypeScript
- **Database**: MySQL with connection pooling via `mysql2/promise`
- **Authentication**: Django-compatible PBKDF2 password verification with session management
- **State Management**: React Context for authentication state
- **Styling**: Tailwind CSS v4 with global styles

### Key Directories
- `src/app/` - Next.js pages and API routes
- `src/lib/` - Core utilities, database queries, and authentication logic
- `src/types/` - TypeScript type definitions
- `src/app/components/` - React components

### Database Integration
- Uses existing Django database schema (auth_user table)
- Connection pooling configured in `src/lib/db.js`
- Structured queries in `src/lib/queries/` directory
- Environment variables for database configuration (DB_HOST, DB_PORT, etc.)

### Authentication Flow
- Session-based authentication with signed cookies
- Compatible with Django password hashing (PBKDF2_SHA256)
- AuthContext provider wraps the entire application
- Protected routes use authentication middleware

### API Structure
- `/api/auth/` - Session management
- `/api/plan/` - Meal planner functionality
- `/api/shop/` - Shopping list functionality
- All API routes return JSON responses

### Component Architecture
- React 19 with TypeScript
- Functional components using hooks
- AuthProvider context for user state management
- Shared components in `src/app/components/`

### Testing Setup
- Jest with jsdom environment for React component testing
- Coverage reporting configured (json-summary, lcov, html)
- Tests located in `__tests__/` directory matching source structure
- Testing Library React for component testing

### Key Features
- Weekly meal planning with recipe management
- Shopping list generation
- Recipe week statistics and grouping
- User authentication and session management
- Static recipe assets served from `/public/static/`

## Development Notes

### Database Queries
- Use parameterized queries to prevent SQL injection
- Connection pool is pre-configured with proper limits
- Database utilities are centralized in `src/lib/db.js`

### Type Safety
- Strict TypeScript configuration
- Shared types in `src/types/` directory
- API response types defined for consistency

### Code Style
- ESLint with Next.js, TypeScript, and Prettier configurations
- Prettier formatting with auto end-of-line handling
- Import paths use `@/` alias for `src/` directory

## Learnings and Updates

Any learnings or updates should be captured in:

- `AGENT.local.md` for general agent guidance
- Or in the specific documentation files as instructed in `AGENT.local.md`