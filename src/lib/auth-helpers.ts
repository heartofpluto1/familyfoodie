import { NextRequest } from 'next/server';
import { getSessionFromRequest } from './auth-middleware';
import { SessionUser } from '@/types/auth';

/**
 * Require that the authenticated user is an admin
 * @param request - The NextRequest object
 * @returns The authenticated admin user or null if not authenticated/not admin
 */
export async function requireAdminUser(request: NextRequest): Promise<SessionUser | null> {
	const user = await getAuthenticatedUser(request);

	if (!user || !user.is_admin) {
		return null;
	}

	return user;
}

/**
 * Get authenticated user from NextRequest
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<SessionUser | null> {
	try {
		const session = await getSessionFromRequest(request);
		if (!session) {
			return null;
		}

		// Session already contains SessionUser
		return session;
	} catch (error) {
		console.error('Error getting authenticated user:', error);
		return null;
	}
}
