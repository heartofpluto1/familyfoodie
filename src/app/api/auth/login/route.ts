// app/api/auth/login/route.ts - Rate Limited Login API
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { encrypt } from '@/lib/session';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic'; // Prevent static generation

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
	try {
		// Check rate limit before processing
		const limitCheck = await rateLimiter.checkLimit(request);

		if (!limitCheck.allowed) {
			return NextResponse.json(
				{
					success: false,
					error: limitCheck.message || 'Too many attempts. Please try again later.',
					retryAfter: limitCheck.retryAfter,
				},
				{
					status: 429,
					headers: {
						'Retry-After': limitCheck.retryAfter?.toString() || '1800',
					},
				}
			);
		}

		const { username, password } = await request.json();

		if (!username || !password) {
			// Record failed attempt for missing credentials
			await rateLimiter.recordAttempt(request, false);
			return NextResponse.json(
				{
					success: false,
					error: 'Username and password are required',
				},
				{ status: 400 }
			);
		}

		// Add progressive delay based on previous failed attempts
		const delayMs = await rateLimiter.getProgressiveDelay(request);
		if (delayMs > 0) {
			await delay(delayMs);
		}

		const authResult = await authenticateUser(username, password);

		if (!authResult.success) {
			// Record failed login attempt
			await rateLimiter.recordAttempt(request, false);

			const remainingCheck = await rateLimiter.checkLimit(request);
			const errorMessage = authResult.error || 'Invalid credentials';

			// Add warning about remaining attempts
			const finalMessage =
				remainingCheck.remainingAttempts !== undefined && remainingCheck.remainingAttempts < 3
					? `${errorMessage}. ${remainingCheck.remainingAttempts} attempts remaining.`
					: errorMessage;

			return NextResponse.json(
				{
					success: false,
					error: finalMessage,
					remainingAttempts: remainingCheck.remainingAttempts,
				},
				{ status: 401 }
			);
		}

		// Record successful login (clears failed attempts)
		await rateLimiter.recordAttempt(request, true);

		// Create session data
		const sessionData = JSON.stringify({
			username,
			loginTime: Date.now(),
		});

		const encryptedSessionData = encrypt(sessionData);

		// Create response and set cookie
		const response = NextResponse.json({
			success: true,
			user: authResult.user,
		});

		response.cookies.set('session', encryptedSessionData, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7, // One week
			path: '/',
			sameSite: 'strict',
		});

		return response;
	} catch (error) {
		console.error('Login API error:', error);

		// Record failed attempt for server errors too
		await rateLimiter.recordAttempt(request, false);

		return NextResponse.json(
			{
				success: false,
				error: 'Something went wrong.',
			},
			{ status: 500 }
		);
	}
}
