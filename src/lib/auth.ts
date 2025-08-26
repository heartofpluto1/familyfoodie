// lib/auth.ts - Authentication utilities
import pool from './db.js';
import { addToast } from '@/lib/toast';
import { SessionUser } from '@/types/auth';

export interface User {
	id: number;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	is_active: boolean;
	is_admin: boolean;
}

export interface AuthResult {
	success: boolean;
	user?: User;
	error?: string;
}

export interface HouseholdAuthResult {
	success: boolean;
	user?: SessionUser;
	error?: string;
}

// Verify Django's PBKDF2 password
async function verifyDjangoPassword(password: string, hashedPassword: string): Promise<boolean> {
	try {
		// Django format: pbkdf2_sha256$iterations$salt$hash
		const parts = hashedPassword.split('$');
		if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
			return false;
		}

		const iterations = parseInt(parts[1]);
		const salt = parts[2];
		const hash = parts[3];

		// Use Node.js crypto to verify PBKDF2
		const crypto = await import('crypto');
		const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
		const derivedHash = derivedKey.toString('base64');

		return derivedHash === hash;
	} catch (error) {
		addToast('error', 'Password Verification Error', 'Password verification failed: ' + (error instanceof Error ? error.message : String(error)));
		return false;
	}
}

export async function authenticateUser(username: string, password: string): Promise<AuthResult> {
	try {
		const [rows] = await pool.execute(
			'SELECT id, username, email, first_name, last_name, password, is_active, is_admin FROM users WHERE username = ? AND is_active = 1',
			[username]
		);

		const users = rows as (User & { password: string })[];
		if (users.length === 0) {
			return { success: false, error: 'Invalid username or password' };
		}

		const user = users[0];
		const isValidPassword = await verifyDjangoPassword(password, user.password);

		if (!isValidPassword) {
			return { success: false, error: 'Invalid username or password' };
		}

		// Update last_login
		await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

		// Return user without password
		const { ...userWithoutPassword } = user;
		return {
			success: true,
			user: userWithoutPassword,
		};
	} catch (error) {
		addToast('error', 'Authentication Error', 'Authentication failed: ' + (error instanceof Error ? error.message : String(error)));
		return { success: false, error: 'Authentication failed' };
	}
}

/**
 * Authenticate user with household context for Agent 2 implementation
 * Joins with households table to get household information
 */
export async function authenticateUserWithHousehold(username: string, password: string): Promise<HouseholdAuthResult> {
	try {
		const [rows] = await pool.execute(
			`SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.password, u.is_active, u.is_admin, 
			        u.household_id, h.name as household_name
			 FROM users u 
			 JOIN households h ON u.household_id = h.id 
			 WHERE u.username = ? AND u.is_active = 1`,
			[username]
		);

		const users = rows as (SessionUser & { password: string })[];
		if (users.length === 0) {
			return { success: false, error: 'Invalid username or password' };
		}

		const user = users[0];
		const isValidPassword = await verifyDjangoPassword(password, user.password);

		if (!isValidPassword) {
			return { success: false, error: 'Invalid username or password' };
		}

		// Update last_login
		await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

		// Return user without password
		const { password: _, ...userWithoutPassword } = user;
		return {
			success: true,
			user: userWithoutPassword,
		};
	} catch (error) {
		addToast('error', 'Authentication Error', 'Authentication with household context failed: ' + (error instanceof Error ? error.message : String(error)));
		return { success: false, error: 'Authentication failed' };
	}
}

/**
 * Validate session and return user with household context
 * Used by withAuth middleware to get household information
 */
export async function validateSessionWithHousehold(userId: number): Promise<SessionUser | null> {
	try {
		const [rows] = await pool.execute(
			`SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active, u.is_admin, 
			        u.household_id, h.name as household_name
			 FROM users u 
			 JOIN households h ON u.household_id = h.id 
			 WHERE u.id = ? AND u.is_active = 1`,
			[userId]
		);

		const users = rows as SessionUser[];
		return users.length > 0 ? users[0] : null;
	} catch (error) {
		addToast('error', 'Session Validation Error', 'Session validation failed: ' + (error instanceof Error ? error.message : String(error)));
		return null;
	}
}
