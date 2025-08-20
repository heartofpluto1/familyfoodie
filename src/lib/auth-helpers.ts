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

/**
 * Get the authenticated user from the request session
 * @param request - The NextRequest object
 * @param forceRefresh - If true, always fetch fresh data from database (useful after permission changes)
 * @returns The authenticated user or null if not authenticated
 */
export async function getAuthenticatedUser(request: NextRequest, forceRefresh = false): Promise<AuthenticatedUser | null> {
	try {
		// Get the session from the request
		const session = await getSessionFromRequest(request);

		if (!session) {
			return null;
		}

		// If session contains full user data and we're not forcing a refresh, use it
		if (!forceRefresh && session.user && 'is_admin' in session.user) {
			return session.user as AuthenticatedUser;
		}

		// Otherwise, fetch from database (for backward compatibility with old sessions)
		const [rows] = await pool.execute('SELECT id, username, email, is_admin, is_active FROM auth_user WHERE id = ?', [session.user?.id || session.username]);

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
