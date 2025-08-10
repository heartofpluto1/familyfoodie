// lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { addToast } from '@/lib/toast';

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
					error: 'Authentication required!!',
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

// Higher-order function to protect API routes
export function withAuth(handler: (request: NextRequest, session: { username: string }) => Promise<NextResponse>) {
	return async (request: NextRequest) => {
		const { response, session } = await requireAuth(request);

		if (response) {
			return response; // Return 401 response
		}

		return handler(request, session);
	};
}
