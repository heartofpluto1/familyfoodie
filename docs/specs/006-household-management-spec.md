# Household Management System Specification

## Executive Summary

This document outlines the implementation of a Household Management System for the FamilyFoodie application. This system provides user registration flows, member administration, role-based permissions, and invitation management for multi-user households. This specification builds upon the core household architecture defined in `household-feature-spec.md`.

## Prerequisites

This specification assumes the following foundation from `household-feature-spec.md` has been implemented:
- `households` table exists
- `users.household_id` foreign key relationship established
- Core household data isolation and sharing mechanisms in place

## Business Requirements

### Core Requirements
1. **User Onboarding Flow**: New users can create households or join existing ones
2. **Role-Based Administration**: Distinguish between household owners and members
3. **Member Management**: Owners can invite and remove household members
4. **Invitation System**: Secure, time-limited invite codes for joining households
5. **Permission Boundaries**: Clear separation between owner and member capabilities
6. **Graceful Member Removal**: Removed members get their own new household

### User Stories

**As a new user**, I want to choose whether to create a new household or join an existing one during signup, so that I can either start fresh or collaborate with family/roommates.

**As a household owner**, I want to invite new members to my household so that we can share meal planning and recipes.

**As a household owner**, I want to remove problematic members from my household so that I can maintain control over our shared data.

**As a household member**, I want to see who else is in my household so that I understand our shared context.

**As any household user**, I want my permissions to be clear so that I understand what actions I can and cannot take.

## Technical Specification

### 1. Database Schema Changes

#### New Tables

```sql
-- Household invitation system
CREATE TABLE household_invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    household_id INT NOT NULL,
    invite_code VARCHAR(32) NOT NULL UNIQUE,
    created_by INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    max_uses INT DEFAULT 1,
    current_uses INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_invite_code (invite_code),
    INDEX idx_household (household_id),
    INDEX idx_expires (expires_at, active)
);
```

#### Modified Tables

```sql
-- Add role-based permissions to users table
ALTER TABLE users ADD COLUMN household_role ENUM('owner', 'member') DEFAULT 'member';
ALTER TABLE users ADD INDEX idx_household_role (household_id, household_role);
```

### 2. Role-Based Permission System

#### Role Hierarchy
- **Owner**: Full administrative control over the household
- **Member**: Standard user access to household features

#### Permissions Matrix
| Action | Owner | Member | Notes |
|--------|-------|--------|-------|
| Create/Edit Recipes | ✓ | ✓ | Both can modify household recipes |
| Meal Planning | ✓ | ✓ | Both can create meal plans |
| Shopping Lists | ✓ | ✓ | Both can manage shopping |
| Subscribe to Collections | ✓ | ✓ | Both can manage subscriptions |
| Create Collections | ✓ | ✓ | Both can create household collections |
| Generate Invite Codes | ✓ | ✗ | Owner-only administrative function |
| Remove Members | ✓ | ✗ | Owner-only administrative function |
| Update Household Settings | ✓ | ✗ | Owner-only administrative function |
| Delete Household | ✓ | ✗ | Owner-only administrative function |

### 3. User Registration and Onboarding Flow

#### New User Registration Process

```typescript
// Registration flow interface
interface RegistrationFlow {
  step1: CreateUserAccount;
  step2: HouseholdChoice;
  step3a: CreateNewHousehold | JoinExistingHousehold;
}

interface CreateUserAccount {
  email: string;
  password: string;
  username: string;
}

interface HouseholdChoice {
  action: 'create' | 'join';
}

interface CreateNewHousehold {
  household_name: string;
}

interface JoinExistingHousehold {
  invite_code: string;
}
```

#### Implementation Flow

```typescript
// src/lib/auth/registration.ts

export async function registerUser(
  email: string, 
  password: string, 
  username: string
): Promise<{ user_id: number; requires_household_setup: true }> {
  // Create user account (without household_id initially)
  const hashedPassword = await hashPassword(password);
  
  const query = `
    INSERT INTO users (email, password, username, household_id)
    VALUES (?, ?, ?, NULL)
  `;
  const [result] = await pool.execute(query, [email, hashedPassword, username]);
  
  return {
    user_id: result.insertId,
    requires_household_setup: true
  };
}

export async function createHouseholdForUser(
  user_id: number, 
  household_name: string
): Promise<number> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Create household
    const householdQuery = `
      INSERT INTO households (name) VALUES (?)
    `;
    const [householdResult] = await connection.execute(householdQuery, [household_name]);
    const household_id = householdResult.insertId;
    
    // Assign user as owner
    const userQuery = `
      UPDATE users 
      SET household_id = ?, household_role = 'owner' 
      WHERE id = ?
    `;
    await connection.execute(userQuery, [household_id, user_id]);
    
    // Auto-subscribe to collection_id=1 (Spencer's essentials)
    const subscribeQuery = `
      INSERT INTO collection_subscriptions (household_id, collection_id)
      SELECT ?, 1
      WHERE 1 IN (SELECT id FROM collections WHERE public = 1)
    `;
    await connection.execute(subscribeQuery, [household_id]);
    
    await connection.commit();
    return household_id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function joinHouseholdViaInvite(
  user_id: number, 
  invite_code: string
): Promise<number> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Validate invite code
    const inviteQuery = `
      SELECT household_id, max_uses, current_uses
      FROM household_invites
      WHERE invite_code = ? 
      AND active = 1 
      AND expires_at > NOW()
      AND current_uses < max_uses
    `;
    const [invites] = await connection.execute(inviteQuery, [invite_code]);
    
    if (invites.length === 0) {
      throw new Error('Invalid or expired invite code');
    }
    
    const household_id = invites[0].household_id;
    
    // Add user to household as member
    const userQuery = `
      UPDATE users 
      SET household_id = ?, household_role = 'member' 
      WHERE id = ?
    `;
    await connection.execute(userQuery, [household_id, user_id]);
    
    // Update invite usage
    const updateInviteQuery = `
      UPDATE household_invites 
      SET current_uses = current_uses + 1
      WHERE invite_code = ?
    `;
    await connection.execute(updateInviteQuery, [invite_code]);
    
    await connection.commit();
    return household_id;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

### 4. Member Management System

#### Invitation System

```typescript
// src/lib/household/invitations.ts

export async function generateInviteCode(
  household_id: number, 
  created_by: number, 
  expires_hours: number = 168, // 7 days default
  max_uses: number = 1
): Promise<string> {
  // Verify creator is household owner
  const permissionQuery = `
    SELECT household_role FROM users 
    WHERE id = ? AND household_id = ?
  `;
  const [permissions] = await pool.execute(permissionQuery, [created_by, household_id]);
  
  if (permissions.length === 0 || permissions[0].household_role !== 'owner') {
    throw new Error('Only household owners can generate invite codes');
  }
  
  // Generate secure random invite code
  const invite_code = crypto.randomBytes(16).toString('hex');
  const expires_at = new Date(Date.now() + expires_hours * 60 * 60 * 1000);
  
  const query = `
    INSERT INTO household_invites (household_id, invite_code, created_by, expires_at, max_uses)
    VALUES (?, ?, ?, ?, ?)
  `;
  await pool.execute(query, [household_id, invite_code, created_by, expires_at, max_uses]);
  
  return invite_code;
}

export async function getActiveInvites(household_id: number): Promise<HouseholdInvite[]> {
  const query = `
    SELECT hi.*, u.username as created_by_name
    FROM household_invites hi
    JOIN users u ON hi.created_by = u.id
    WHERE hi.household_id = ? 
    AND hi.active = 1 
    AND hi.expires_at > NOW()
    ORDER BY hi.created_at DESC
  `;
  const [rows] = await pool.execute(query, [household_id]);
  return rows;
}

export async function deactivateInvite(
  invite_id: number, 
  household_id: number, 
  requester_id: number
): Promise<boolean> {
  // Verify requester is household owner
  const permissionQuery = `
    SELECT household_role FROM users 
    WHERE id = ? AND household_id = ?
  `;
  const [permissions] = await pool.execute(permissionQuery, [requester_id, household_id]);
  
  if (permissions.length === 0 || permissions[0].household_role !== 'owner') {
    throw new Error('Only household owners can deactivate invites');
  }
  
  const query = `
    UPDATE household_invites 
    SET active = 0 
    WHERE id = ? AND household_id = ?
  `;
  const [result] = await pool.execute(query, [invite_id, household_id]);
  
  return result.affectedRows > 0;
}
```

#### Member Removal System

```typescript
// src/lib/household/members.ts

export async function removeMember(
  household_id: number, 
  user_id: number, 
  requester_id: number
): Promise<{ new_household_id: number; user_moved: boolean }> {
  // Verify requester is household owner
  const permissionQuery = `
    SELECT household_role FROM users 
    WHERE id = ? AND household_id = ?
  `;
  const [permissions] = await pool.execute(permissionQuery, [requester_id, household_id]);
  
  if (permissions.length === 0 || permissions[0].household_role !== 'owner') {
    throw new Error('Only household owners can remove members');
  }
  
  // Verify target user exists and get their info
  const targetQuery = `
    SELECT household_role, username FROM users 
    WHERE id = ? AND household_id = ?
  `;
  const [targets] = await pool.execute(targetQuery, [user_id, household_id]);
  
  if (targets.length === 0) {
    throw new Error('User not found in household');
  }
  
  if (targets[0].household_role === 'owner') {
    throw new Error('Cannot remove household owner');
  }
  
  if (user_id === requester_id) {
    throw new Error('Cannot remove yourself');
  }
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Create new household for the removed user
    const newHouseholdName = `${targets[0].username}'s Household`;
    const newHouseholdQuery = `
      INSERT INTO households (name) VALUES (?)
    `;
    const [householdResult] = await connection.execute(newHouseholdQuery, [newHouseholdName]);
    const new_household_id = householdResult.insertId;
    
    // Move user to new household as owner
    const moveUserQuery = `
      UPDATE users 
      SET household_id = ?, household_role = 'owner' 
      WHERE id = ?
    `;
    await connection.execute(moveUserQuery, [new_household_id, user_id]);
    
    // Auto-subscribe new household to collection_id=1
    const subscribeQuery = `
      INSERT INTO collection_subscriptions (household_id, collection_id)
      SELECT ?, 1
      WHERE 1 IN (SELECT id FROM collections WHERE public = 1)
    `;
    await connection.execute(subscribeQuery, [new_household_id]);
    
    await connection.commit();
    return { new_household_id, user_moved: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getHouseholdMembers(household_id: number): Promise<HouseholdMember[]> {
  const query = `
    SELECT id, username, email, household_role, created_at
    FROM users
    WHERE household_id = ?
    ORDER BY household_role DESC, username
  `;
  const [rows] = await pool.execute(query, [household_id]);
  return rows;
}

export async function updateMemberRole(
  household_id: number,
  user_id: number,
  new_role: 'owner' | 'member',
  requester_id: number
): Promise<boolean> {
  // Only owners can change roles, and there must always be at least one owner
  const permissionQuery = `
    SELECT household_role FROM users 
    WHERE id = ? AND household_id = ?
  `;
  const [permissions] = await pool.execute(permissionQuery, [requester_id, household_id]);
  
  if (permissions.length === 0 || permissions[0].household_role !== 'owner') {
    throw new Error('Only household owners can change member roles');
  }
  
  // If demoting to member, ensure at least one owner remains
  if (new_role === 'member') {
    const ownerCountQuery = `
      SELECT COUNT(*) as owner_count
      FROM users 
      WHERE household_id = ? AND household_role = 'owner'
    `;
    const [ownerCount] = await pool.execute(ownerCountQuery, [household_id]);
    
    if (ownerCount[0].owner_count <= 1) {
      throw new Error('Cannot remove last household owner');
    }
  }
  
  const query = `
    UPDATE users 
    SET household_role = ?
    WHERE id = ? AND household_id = ?
  `;
  const [result] = await pool.execute(query, [new_role, user_id, household_id]);
  
  return result.affectedRows > 0;
}
```

### 5. API Endpoints Specification

#### Authentication Integration

```typescript
// src/lib/auth/context.ts - Enhanced AuthContext

export interface User {
  id: number;
  username: string;
  email: string;
  household_id: number;
  household_role: 'owner' | 'member';
  created_at: string;
}

export interface Household {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  member_count: number;
}

export interface AuthContextType {
  user: User | null;
  household: Household | null;
  members: HouseholdMember[];
  isOwner: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshHouseholdData: () => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (invite_code: string) => Promise<void>;
}
```

#### REST API Endpoints

```typescript
// src/app/api/households/route.ts

// GET /api/households/current
// Returns current user's household information
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const household = await getCurrentHousehold(user.id);
  const members = await getHouseholdMembers(user.household_id);
  
  return NextResponse.json({
    household,
    members,
    user_role: user.household_role
  });
}

// PUT /api/households/current
// Update household settings (owner only)
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.household_role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { name } = await request.json();
  await updateHousehold(user.household_id, user.id, { name });
  
  return NextResponse.json({ success: true });
}

// src/app/api/households/create/route.ts

// POST /api/households/create
// Create new household for user
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.household_id) {
    return NextResponse.json({ error: 'User already has household' }, { status: 400 });
  }
  
  const { name } = await request.json();
  const household_id = await createHouseholdForUser(user.id, name);
  
  return NextResponse.json({
    household_id,
    message: 'Household created successfully'
  });
}

// src/app/api/households/join/route.ts

// POST /api/households/join
// Join existing household via invite code
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.household_id) {
    return NextResponse.json({ error: 'User already has household' }, { status: 400 });
  }
  
  const { invite_code } = await request.json();
  const household_id = await joinHouseholdViaInvite(user.id, invite_code);
  
  return NextResponse.json({
    household_id,
    message: 'Successfully joined household'
  });
}

// src/app/api/households/invites/route.ts

// GET /api/households/invites
// Get active invites (owner only)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.household_role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const invites = await getActiveInvites(user.household_id);
  return NextResponse.json({ invites });
}

// POST /api/households/invites
// Generate new invite code (owner only)
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.household_role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { expires_hours = 168, max_uses = 1 } = await request.json();
  const invite_code = await generateInviteCode(
    user.household_id, 
    user.id, 
    expires_hours, 
    max_uses
  );
  
  return NextResponse.json({
    invite_code,
    expires_hours,
    max_uses
  });
}

// src/app/api/households/members/[user_id]/route.ts

// DELETE /api/households/members/[user_id]
// Remove member from household (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { user_id: string } }
) {
  const user = await getCurrentUser(request);
  if (!user || user.household_role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const user_id = parseInt(params.user_id);
  const result = await removeMember(user.household_id, user_id, user.id);
  
  return NextResponse.json({
    success: true,
    new_household_id: result.new_household_id,
    message: 'Member removed and moved to new household'
  });
}
```

### 6. Type Definitions

```typescript
// src/types/household-management.ts

export interface HouseholdInvite {
  id: number;
  household_id: number;
  invite_code: string;
  created_by: number;
  created_by_name: string;
  expires_at: string;
  max_uses: number;
  current_uses: number;
  active: boolean;
  created_at: string;
}

export interface HouseholdMember {
  id: number;
  username: string;
  email: string;
  household_role: 'owner' | 'member';
  created_at: string;
}

export interface CreateHouseholdRequest {
  name: string;
}

export interface JoinHouseholdRequest {
  invite_code: string;
}

export interface CreateInviteRequest {
  expires_hours?: number;
  max_uses?: number;
}

export interface UpdateHouseholdRequest {
  name?: string;
}

// Permission helper types
export type HouseholdPermission = 
  | 'manage_members'
  | 'update_settings' 
  | 'generate_invites'
  | 'remove_members'
  | 'delete_household';

export interface PermissionCheck {
  user: User;
  permission: HouseholdPermission;
  result: boolean;
}
```

### 7. Permission Helper Functions

```typescript
// src/lib/permissions/household.ts

export function canManageMembers(user: User): boolean {
  return user.household_role === 'owner';
}

export function canUpdateHouseholdSettings(user: User): boolean {
  return user.household_role === 'owner';
}

export function canGenerateInvites(user: User): boolean {
  return user.household_role === 'owner';
}

export function canRemoveMembers(user: User): boolean {
  return user.household_role === 'owner';
}

export function canDeleteHousehold(user: User): boolean {
  return user.household_role === 'owner';
}

export function hasPermission(user: User, permission: HouseholdPermission): boolean {
  switch (permission) {
    case 'manage_members':
      return canManageMembers(user);
    case 'update_settings':
      return canUpdateHouseholdSettings(user);
    case 'generate_invites':
      return canGenerateInvites(user);
    case 'remove_members':
      return canRemoveMembers(user);
    case 'delete_household':
      return canDeleteHousehold(user);
    default:
      return false;
  }
}

export async function requirePermission(
  request: NextRequest, 
  permission: HouseholdPermission
): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  if (!hasPermission(user, permission)) {
    throw new Error('Forbidden');
  }
  
  return user;
}
```

### 8. Migration Integration

This system integrates with the existing household feature migration by adding the following steps:

```sql
-- Add to existing migration after Step 15 in household-feature-spec.md

-- Step 16: Add role column to users
ALTER TABLE users ADD COLUMN household_role ENUM('owner', 'member') DEFAULT 'member';

-- Step 17: Set first user in Spencer household as owner
UPDATE users 
SET household_role = 'owner'
WHERE id = (SELECT MIN(id) FROM (SELECT * FROM users) u2 WHERE household_id = 1);

-- Step 18: Create household_invites table
CREATE TABLE household_invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    household_id INT NOT NULL,
    invite_code VARCHAR(32) NOT NULL UNIQUE,
    created_by INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    max_uses INT DEFAULT 1,
    current_uses INT DEFAULT 0,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_invite_code (invite_code),
    INDEX idx_household (household_id),
    INDEX idx_expires (expires_at, active)
);

-- Step 19: Add index for role-based queries
ALTER TABLE users ADD INDEX idx_household_role (household_id, household_role);
```

### 9. Frontend UI Requirements

#### Registration Flow Components

```typescript
// src/components/auth/RegistrationWizard.tsx
// - Step 1: Basic user info (email, password, username)
// - Step 2: Household choice (create new vs join existing)  
// - Step 3a: Create household (household name input)
// - Step 3b: Join household (invite code input)

// src/components/auth/HouseholdChoice.tsx
// - Radio button selection between create/join
// - Clear descriptions of each option
// - Visual icons for different paths

// src/components/auth/CreateHousehold.tsx
// - Household name input field
// - Preview of auto-subscription to Spencer's essentials
// - Submit button with loading state

// src/components/auth/JoinHousehold.tsx
// - Invite code input field
// - Validation feedback for invalid codes
// - Submit button with loading state
```

#### Household Management Dashboard

```typescript
// src/components/household/ManagementDashboard.tsx (Owner Only)
// - Household name editing
// - Member list with roles
// - Invite generation section
// - Active invites list with deactivation
// - Member removal actions

// src/components/household/MembersList.tsx
// - Display all household members
// - Show roles (owner/member badges)
// - Remove member buttons (owner only)
// - Role change dropdowns (owner only)

// src/components/household/InviteManagement.tsx (Owner Only)
// - Generate new invite button
// - Configure expiration and max uses
// - List of active invites with usage stats
// - Deactivate invite buttons

// src/components/household/HouseholdSettings.tsx (Owner Only)
// - Household name editor
// - Household statistics (member count, creation date)
// - Danger zone (delete household - future feature)
```

#### Member Experience Components

```typescript
// src/components/household/HouseholdInfo.tsx (All Users)
// - Display household name and member count
// - List of household members with roles
// - "You are a [role]" indicator

// src/components/household/InviteDisplay.tsx
// - Copy invite code to clipboard
// - QR code generation for easy sharing
// - Expiration countdown display
```

### 10. Implementation Phases

#### Phase 1: Core Database and API (Week 1)
- [ ] Create household_invites table migration
- [ ] Add household_role column to users
- [ ] Implement registration flow API endpoints
- [ ] Implement invitation system API endpoints
- [ ] Write permission helper functions

#### Phase 2: Member Management (Week 1-2)
- [ ] Implement member removal system
- [ ] Create household management API endpoints
- [ ] Add role-based permission middleware
- [ ] Write comprehensive API tests

#### Phase 3: Frontend Integration (Week 2-3)
- [ ] Update AuthContext with household management
- [ ] Create registration wizard components
- [ ] Build household management dashboard
- [ ] Implement invitation flow UI

#### Phase 4: Testing and Polish (Week 3)
- [ ] Integration testing for all flows
- [ ] Permission boundary testing
- [ ] User experience testing
- [ ] Security audit of invitation system

### 11. Success Criteria

1. **Seamless Onboarding**: New users can easily choose between creating or joining households
2. **Clear Role Separation**: Owners have administrative control while members have full feature access
3. **Secure Invitations**: Invite codes expire appropriately and cannot be abused
4. **Graceful Member Management**: Removing members doesn't break their experience
5. **Intuitive Permissions**: Users understand what they can and cannot do
6. **Robust Error Handling**: All edge cases handled with clear error messages
7. **Mobile-Friendly**: All flows work well on mobile devices

### 12. Security Considerations

#### Invitation Code Security
- Cryptographically secure random generation (crypto.randomBytes)
- Time-based expiration (default 7 days)
- Usage limits to prevent abuse
- Deactivation capabilities for compromised codes

#### Permission Enforcement
- Server-side validation on all administrative actions
- Database-level foreign key constraints prevent orphaned data
- Role checks on every protected endpoint
- No client-side permission assumptions

#### Data Isolation
- Member removal preserves user's data in new household
- No cascade deletions that could affect other households
- Clear ownership boundaries for all resources

This specification provides a complete foundation for household user management while maintaining security, usability, and clear separation of concerns from the core household data architecture.