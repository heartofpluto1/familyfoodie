// lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { addToast } from '@/lib/toast';
import { SessionUser } from '@/types/auth';
import { validateSessionWithHousehold } from '@/lib/auth';

export interface AuthenticatedRequest extends NextRequest {
	user: SessionUser;
	household_id: number;
}

export async function getSessionFromRequest(request: NextRequest) {
	try {
		// Import decrypt function
		const { decrypt } = await import('@/lib/session');

		// Get session cookie from request
		const sessionCookie = request.cookies.get('session');

		if (!sessionCookie?.value) {
			return null;
		}

		const sessionData = decrypt(sessionCookie.value);
		return JSON.parse(sessionData);
	} catch (error) {
		addToast('error', 'Session Verification Error', error instanceof Error ? error.message : String(error));
		return null;
	}
}

export async function requireAuth(request: NextRequest) {
	const session = await getSessionFromRequest(request);

	if (!session) {
		return {
			response: NextResponse.json(
				{
					success: false,
					error: 'Authentication required',
					code: 'UNAUTHORIZED',
				},
				{ status: 401 }
			),
			session: null,
		};
	}

	return {
		response: null,
		session,
	};
}

/**
 * Enhanced authentication that includes household context
 * Used by Agent 2 implementation for household-scoped API routes
 */
export async function requireAuthWithHousehold(request: NextRequest) {
	const basicSession = await getSessionFromRequest(request);

	if (!basicSession || !basicSession.id) {
		return {
			response: NextResponse.json(
				{
					success: false,
					error: 'Authentication required',
					code: 'UNAUTHORIZED',
				},
				{ status: 401 }
			),
			user: null,
		};
	}

	// Get full user context with household information
	const user = await validateSessionWithHousehold(basicSession.id);

	if (!user) {
		return {
			response: NextResponse.json(
				{
					success: false,
					error: 'Invalid session or user not found',
					code: 'UNAUTHORIZED',
				},
				{ status: 401 }
			),
			user: null,
		};
	}

	return {
		response: null,
		user,
	};
}

// Define Next.js App Router context type
type RouteContext = {
	params: Promise<Record<string, string | string[]>>;
};

/**
 * Enhanced higher-order function with household context for Agent 2 implementation
 * Provides SessionUser with household_id directly on the request object
 *
 * Supports handlers with flexible signatures:
 * - (request) => Promise<NextResponse>
 * - (request, context) => Promise<NextResponse>
 */
export function withAuth(
	handler: ((request: AuthenticatedRequest) => Promise<NextResponse>) | ((request: AuthenticatedRequest, context: RouteContext) => Promise<NextResponse>)
) {
	return async (request: NextRequest, context: RouteContext) => {
		const { response, user } = await requireAuthWithHousehold(request);

		if (response) {
			return response; // Return 401 response
		}

		// Add household context to request
		const authenticatedRequest = request as AuthenticatedRequest;
		authenticatedRequest.user = user!;
		authenticatedRequest.household_id = user!.household_id;

		// Check if handler expects context parameter by checking its length
		if (handler.length >= 2) {
			// Handler expects context parameter
			return (handler as (request: AuthenticatedRequest, context: RouteContext) => Promise<NextResponse>)(authenticatedRequest, context);
		} else {
			// Handler only expects request parameter
			return (handler as (request: AuthenticatedRequest) => Promise<NextResponse>)(authenticatedRequest);
		}
	};
}
