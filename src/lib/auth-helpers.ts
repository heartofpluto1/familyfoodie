import { NextRequest } from 'next/server';
import { getSessionFromRequest } from './auth-middleware';
import pool from './db.js';

export interface AuthenticatedUser {
	id: number;
	username: string;
	email: string;
	is_admin: boolean;
	is_active: boolean;
}

export interface SessionData {
	user: AuthenticatedUser;
	loginTime: number;
}

/**
 * Require that the authenticated user is an admin
 * @param request - The NextRequest object
 * @returns The authenticated admin user or null if not authenticated/not admin
 */
export async function requireAdminUser(request: NextRequest): Promise<AuthenticatedUser | null> {
	const user = await getAuthenticatedUser(request);

	if (!user || !user.is_admin) {
		return null;
	}

	return user;
}

/**
 * Get authenticated user from NextRequest
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
	try {
		const session = await getSessionFromRequest(request);
		if (!session) {
			return null;
		}

		// If session contains full user data, use it
		if (session.user && 'is_admin' in session.user && 'is_active' in session.user && session.user.is_admin && session.user.is_active) {
			return session.user as AuthenticatedUser;
		}

		// Otherwise, fetch from database for old sessions
		const userId = session.user?.id;
		if (!userId) {
			return null;
		}

		const [rows] = await pool.execute('SELECT id, username, email, is_admin, is_active FROM users WHERE id = ?', [userId]);
		const users = rows as AuthenticatedUser[];

		if (!users || users.length === 0) {
			return null;
		}

		return users[0];
	} catch (error) {
		console.error('Error getting authenticated user:', error);
		return null;
	}
}

/**
 * Get authenticated user from decrypted session data
 */
export async function getAuthenticatedUserFromSession(sessionData: SessionData): Promise<AuthenticatedUser | null> {
	try {
		if (!sessionData) {
			return null;
		}

		// If session contains full user data, use it
		if (sessionData.user && 'is_admin' in sessionData.user && 'is_active' in sessionData.user && sessionData.user.is_admin && sessionData.user.is_active) {
			return sessionData.user as AuthenticatedUser;
		}

		// Otherwise, fetch from database for old sessions
		const userId = sessionData.user?.id;
		if (!userId) {
			return null;
		}

		const [rows] = await pool.execute('SELECT id, username, email, is_admin, is_active FROM users WHERE id = ?', [userId]);
		const users = rows as AuthenticatedUser[];

		if (!users || users.length === 0) {
			return null;
		}

		return users[0];
	} catch (error) {
		console.error('Error getting authenticated user from session:', error);
		return null;
	}
}
