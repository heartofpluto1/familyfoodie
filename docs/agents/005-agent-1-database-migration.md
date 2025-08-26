# Agent 1: Database & Migration Implementation

**Parent Spec:** [005-household-feature-spec.md](../specs/005-household-feature-spec.md)  
**Agent Role:** Database Schema, Migration & Copy-on-Write Implementation Specialist  
**Assigned Sections:** Database Schema Changes (§1), Data Migration Strategy (§5), Application Copy-on-Write Logic (§4)

## Required reading

Agent 1 must read these docs:
- [schema.sql](../db/schema.sql)
- [005-household-feature-spec.md](../specs/005-household-feature-spec.md)
- [001-current-system-architecture-spec.md](../specs/001-current-system-architecture-spec.md)
- Agent 1 must use existing migrations tool [run-migrations.mjs](../../migrations/run-migrations.mjs) without modifying it and add all changes to a new migration file in [migrations](../../migrations/) directory.

## Git Workflow Requirements

### Branch Management
**BEFORE starting any work**, Agent 1 must create and checkout a dedicated branch:

```bash
# Create and checkout feature branch
git checkout -b feature/household-feature-integration-agent-1
git push -u origin feature/household-feature-integration-agent-1
```

### Commit Strategy
**AFTER each completed task**, Agent 1 must commit and push changes:

```bash
# Stage changes
git add .

# Commit with descriptive message referencing task
git commit -m "feat: [Task X.Y] Brief description of changes

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push origin feature/household-feature-integration-agent-1
```

**IMPORTANT**: After completing EVERY individual task (1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4), run the commit commands above with the appropriate task-specific message from the list below.

### Commit Message Format
- **Task 1.1**: `feat: [Task 1.1] Create core household infrastructure tables`
- **Task 1.2**: `feat: [Task 1.2] Implement collection_recipes junction table`
- **Task 1.3**: `feat: [Task 1.3] Create collection subscription system tables`
- **Task 2.1**: `feat: [Task 2.1] Add user-household relationship column`
- **Task 2.2**: `feat: [Task 2.2] Add collection ownership and parent tracking`
- **Task 2.3**: `feat: [Task 2.3] Add recipe copy-on-write setup columns`
- **Task 2.4**: `feat: [Task 2.4] Add household ownership to ingredients and recipe_ingredients`
- **Task 2.5**: `feat: [Task 2.5] Add household scope to private data tables`
- **Task 3.1**: `feat: [Task 3.1] Create Spencer household and assign users`
- **Task 3.2**: `feat: [Task 3.2] Assign household ownership to all resources`
- **Task 3.3**: `feat: [Task 3.3] Populate junction tables with existing relationships`
- **Task 4.1**: `feat: [Task 4.1] Implement enhanced cascade copy TypeScript functions`
- **Task 4.2**: `feat: [Task 4.2] Create application-level cleanup functions`
- **Task 5.1**: `feat: [Task 5.1] Validate data integrity after migration`
- **Task 5.2**: `feat: [Task 5.2] Perform performance testing on household queries`
- **Task 5.3**: `feat: [Task 5.3] Create rollback procedures for migration safety`
- **Task 5.4**: `test: [Task 5.4] Run system verification (lint, test, build)`

## Scope & Responsibilities

This agent is responsible for all database-level changes required for the household feature implementation, including schema modifications, data migration, and application-level copy-on-write functions.

### Primary Deliverables

1. **Database Schema Implementation**
   - Create `households` table
   - Create `collection_recipes` junction table  
   - Create `collection_subscriptions` table
   - Add household ownership columns to all relevant tables
   - Add parent tracking columns for copy-on-write functionality
   - Make all SQL idempotent so it's safe to run the migration multiple times

2. **Data Migration Execution**
   - Execute all 12 database migration steps from the parent spec
   - Create "Spencer" household and migrate existing data
   - Populate junction tables from existing relationships
   - Validate data integrity throughout migration

3. **Application Copy-on-Write Functions**
   - Implement `copyRecipeForEdit()` and `copyIngredientForEdit()` TypeScript functions
   - Create application-level cleanup logic for orphaned resources
   - Implement cascade copying logic with transaction management
   - Write comprehensive unit tests for all copy functions

4. **Performance Optimization**
   - Add all required indexes for household-scoped queries
   - Optimize junction table indexes for query performance
   - Test query performance with large datasets

## Detailed Task Breakdown

### Phase 1: Schema Creation (Days 1-2)

#### Task 1.1: Core Household Infrastructure
```sql
-- Create households table with proper indexing
CREATE TABLE households (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);
```

#### Task 1.2: Junction Table Implementation
```sql
-- Create collection_recipes junction table (key optimization)
CREATE TABLE collection_recipes (
    collection_id INT NOT NULL,
    recipe_id INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    display_order INT DEFAULT 0,
    PRIMARY KEY (collection_id, recipe_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    INDEX idx_recipe_collection (recipe_id, collection_id),
    INDEX idx_display_order (collection_id, display_order)
);
```

#### Task 1.3: Subscription System
```sql
-- Create collection_subscriptions table
CREATE TABLE collection_subscriptions (
    household_id INT NOT NULL,
    collection_id INT NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (household_id, collection_id),
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    INDEX idx_household (household_id),
    INDEX idx_collection (collection_id)
);
```

### Phase 2: Table Modifications (Days 3-4)

#### Task 2.1: User-Household Relationship
- Add `household_id INT NOT NULL` to `users` table
- Create foreign key constraint to `households`
- Add index on `household_id`

#### Task 2.2: Collection Ownership
- Add `household_id INT NOT NULL` to `collections` table
- Add `public TINYINT(1) DEFAULT 0` for sharing control
- Add `parent_id INT NULL` for copy tracking
- Create all foreign key constraints and indexes

#### Task 2.3: Recipe Copy-on-Write Setup
- Remove `collection_id` from `recipes` table (replaced by junction)
- Add `household_id INT NOT NULL` to `recipes` table
- Add `parent_id INT NULL` for lineage tracking
- Create foreign key constraints and indexes

#### Task 2.4: Ingredient & Recipe Ingredient Modifications
- Add `household_id INT NOT NULL` to `ingredients` table
- Add `parent_id INT NULL` to both `ingredients` and `recipe_ingredients`
- Create all foreign key constraints and indexes

#### Task 2.5: Private Data Modifications
- Add `household_id INT NOT NULL` to `plans` table
- Add `household_id INT NOT NULL` to `shopping_lists` table
- Create composite indexes on `(household_id, week, year)`

### Phase 3: Migration Execution (Days 5-6)

#### Task 3.1: Spencer Household Creation & User Assignment
```sql
-- Create Spencer household and assign all existing users
INSERT INTO households (name) VALUES ('Spencer');
SET @spencer_household_id = LAST_INSERT_ID();

-- Assign all existing users to Spencer household
UPDATE users SET household_id = @spencer_household_id;
```

#### Task 3.2: Resource Ownership Assignment
```sql
-- Spencer owns all existing collections, recipes, and ingredients
UPDATE collections SET household_id = @spencer_household_id, public = 0;
-- Make collection_id=1 public by default (Spencer's essentials)
UPDATE collections SET public = 1 WHERE id = 1;
UPDATE recipes SET household_id = @spencer_household_id;
UPDATE ingredients SET household_id = @spencer_household_id;
UPDATE plans SET household_id = @spencer_household_id;
UPDATE shopping_lists SET household_id = @spencer_household_id;
```

#### Task 3.3: Junction Table Population
```sql
-- Migrate existing recipe-collection relationships
INSERT INTO collection_recipes (collection_id, recipe_id, added_at)
SELECT collection_id, id, NOW() 
FROM recipes 
WHERE collection_id IS NOT NULL;

-- Auto-subscribe all households to collection_id=1
INSERT INTO collection_subscriptions (household_id, collection_id)
SELECT h.id, 1 FROM households h
WHERE 1 IN (SELECT id FROM collections WHERE id = 1);
```

### Phase 4: Application Copy-on-Write Functions (Day 7)

#### Task 4.1: Enhanced Collection Context-Aware Copy-on-Write Functions
Implement both the original copy-on-write functions AND the enhanced collection context-aware functions:

**File Structure:**
- `src/lib/copy-on-write.ts` - Main copy-on-write functions
- `src/lib/queries/copy-operations.ts` - Database query utilities for copy operations
- `src/lib/copy-on-write.test.ts` - Comprehensive unit tests
- `src/lib/queries/copy-operations.test.ts` - Database query tests

**Original Functions** (from parent spec "Edit Triggers Copy" section):
- `copyRecipeForEdit()` - Single recipe copying with junction table updates and transaction management
- `copyIngredientForEdit()` - Single ingredient copying with recipe updates and proper error handling

**Enhanced Collection Context-Aware Functions** (for URL routing scenarios):
- `cascadeCopyWithContext()` - Collection + recipe cascade copying with collection context validation
- `cascadeCopyIngredientWithContext()` - Full collection → recipe → ingredient cascade copying

These enhanced functions handle the critical collection context scenarios identified:
- Spencer edits Williams collection → Johnson recipe (copies both collection and recipe)
- Spencer edits subscribed collection → owned recipe (copies collection only)  
- Spencer edits owned collection → external recipe (copies recipe only)

The enhanced functions validate entire ownership chains and ensure complete resource isolation for multi-household editing scenarios accessed via `/recipes/[collection_slug]/[recipe_slug]` URLs.

**Function Signatures:**
```typescript
// Main copy-on-write functions
export async function copyRecipeForEdit(
  recipeId: number, 
  householdId: number
): Promise<{ newRecipeId: number; copied: boolean }>;

export async function copyIngredientForEdit(
  ingredientId: number, 
  householdId: number
): Promise<{ newIngredientId: number; copied: boolean }>;

export async function cascadeCopyWithContext(
  householdId: number,
  collectionId: number, 
  recipeId: number
): Promise<{
  newCollectionId: number;
  newRecipeId: number;
  actionsTaken: string[];
}>;

export async function cascadeCopyIngredientWithContext(
  householdId: number,
  collectionId: number,
  recipeId: number, 
  ingredientId: number
): Promise<{
  newCollectionId: number;
  newRecipeId: number;
  newIngredientId: number;
  actionsTaken: string[];
}>;
```

#### Task 4.2: Application-Level Cleanup Logic
Implement application-level cleanup functions to replace database triggers:

**Functions to Implement:**
- `cleanupOrphanedIngredients()` - Clean up orphaned household-owned ingredients after recipe deletion
- `cleanupOrphanedRecipeIngredients()` - Clean up recipe_ingredients entries after recipe deletion
- Integration with existing delete API endpoints to call cleanup functions

**Function Signatures:**
```typescript
export async function cleanupOrphanedIngredients(
  householdId: number, 
  deletedRecipeId: number
): Promise<{ deletedIngredientIds: number[] }>;

export async function cleanupOrphanedRecipeIngredients(
  recipeId: number
): Promise<{ deletedCount: number }>;
```

### Phase 5: Testing & Validation (Days 8-10)

#### Task 5.1: Data Integrity Validation
- Verify all foreign key constraints are properly created
- Confirm all existing data migrated without loss
- Test that all NOT NULL constraints are satisfied

#### Task 5.2: Performance Testing
- Benchmark junction table queries vs old collection_id queries
- Test copy function performance with large datasets
- Validate index effectiveness on household-scoped queries

#### Task 5.3: System Verification
After completing all database changes, run comprehensive verification to ensure the system still works correctly:

```bash
# RUN THESE COMMANDS to verify the system after database migration:

# 1. TypeScript compilation check
npx tsc --noEmit

# 2. ESLint check for any code that may be affected by schema changes
npm run lint

# 3. Run all tests to ensure database changes don't break existing functionality
npm run test

# 4. Build check to ensure the application can still build successfully
npm run build
```

**Verification Requirements:**
- All commands must pass without errors
- If any tests fail due to schema changes, document them for Agent 2 to address
- Ensure database migrations didn't break existing authentication or query functionality
- Confirm that copy-on-write functions work as expected

## Dependencies

### Upstream Dependencies (Must Complete First)
- None - this agent provides the foundation for others

### Downstream Dependencies (Other Agents Depend On)
- **Agent 2** requires completed database schema for query implementation
- **Agent 3** requires completed migration for authentication context

## Success Criteria

### Git Workflow Requirements
- [ ] Feature branch `feature/household-feature-integration-agent-1` created and checked out before starting
- [ ] Each task committed individually with descriptive commit messages
- [ ] All commits pushed to remote branch after completion
- [ ] Commit messages follow specified format with task numbers
- [ ] Claude Code attribution included in all commit messages

### Functional Requirements
- [ ] All 12 migration steps completed successfully
- [ ] Spencer household created with all existing data
- [ ] Junction table approach implemented (14x storage savings achieved)
- [ ] Original copy-on-write functions working correctly (`copyRecipeForEdit`, `copyIngredientForEdit`)
- [ ] Enhanced collection context-aware functions working correctly (`cascadeCopyWithContext`, `cascadeCopyIngredientWithContext`)
- [ ] All foreign key constraints properly enforced

### Collection Context Requirements (Enhanced)
- [ ] Enhanced copy-on-write functions validate entire collection → recipe → ingredient ownership chains
- [ ] Multi-household cascade copying scenarios working correctly
- [ ] URL slug retrieval integrated for frontend redirection after copying
- [ ] Transaction safety maintained across collection + recipe + ingredient copying operations

### Performance Requirements
- [ ] Junction table queries show 5-10x performance improvement over previous approach
- [ ] No performance degradation in existing functionality
- [ ] Copy functions execute within 200ms for typical operations

### Data Integrity Requirements
- [ ] Zero data loss during migration
- [ ] All existing relationships preserved in junction tables
- [ ] Parent-child relationships properly tracked
- [ ] Automatic cleanup working correctly

### System Verification Requirements
- [ ] TypeScript compilation passes without errors (`npx tsc --noEmit`)
- [ ] ESLint passes with no errors (`npm run lint`)
- [ ] All existing tests pass after database migration (`npm run test`)
- [ ] Application builds successfully (`npm run build`)
- [ ] Any test failures due to schema changes documented for Agent 2
- [ ] Database migrations don't break existing authentication
- [ ] Copy-on-write functions and cleanup logic work correctly

## Risk Mitigation

### High Risk: Data Loss During Migration
- **Mitigation**: Full database backup before migration, comprehensive testing on staging
- **Idempotent**: Ensure SQL is idempotent so it's safe to run multiple times

### Medium Risk: Performance Degradation
- **Mitigation**: Benchmark before/after, optimize indexes proactively
- **Idempotent**: Ensure SQL is idempotent so it's safe to run multiple times

### Medium Risk: Complex Copy Functions
- **Mitigation**: Extensive unit testing, step-by-step validation, comprehensive test coverage
- **Transaction Safety**: Ensure all copy functions use proper transaction management

## Testing Strategy

1. **Unit Tests**: Test each copy function in isolation with mocked database calls
2. **Integration Tests**: Test complete migration flow on test data
3. **Copy Function Tests**: Test all copy-on-write scenarios with real database transactions
4. **Transaction Tests**: Verify rollback behavior on copy function failures
5. **Data Validation**: Verify data integrity at each migration step

## Handoff to Other Agents

Upon completion, provide Agent 2 and Agent 3 with:
- Updated database schema documentation
- Connection strings and access credentials
- Performance benchmark results
- Data model examples for testing their implementations