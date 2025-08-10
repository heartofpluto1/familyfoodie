import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth';
import { encrypt } from '@/lib/session';
import { rateLimiter } from '@/lib/rate-limiter';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
	// Helper function to construct URLs using Host header
	const constructUrl = (path: string) => {
		const host = request.headers.get('host') || 'localhost:3000';
		const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
		return `${protocol}://${host}${path}`;
	};

	try {
		// Check rate limit before processing
		const limitCheck = await rateLimiter.checkLimit(request);

		if (!limitCheck.allowed) {
			// Redirect back to login with error parameters
			const loginUrl = new URL(constructUrl('/login'));
			loginUrl.searchParams.set('error', limitCheck.message || 'Too many attempts. Please try again later.');
			if (limitCheck.retryAfter) {
				const minutes = Math.ceil(limitCheck.retryAfter / 60);
				loginUrl.searchParams.set('error', `Too many failed attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`);
			}
			return NextResponse.redirect(loginUrl);
		}

		// Get form data
		const formData = await request.formData();
		const username = formData.get('username') as string;
		const password = formData.get('password') as string;

		if (!username || !password) {
			// Record failed attempt and redirect with error
			await rateLimiter.recordAttempt(request, false);
			const loginUrl = new URL(constructUrl('/login'));
			loginUrl.searchParams.set('error', 'Username and password are required');
			return NextResponse.redirect(loginUrl);
		}

		// Add progressive delay based on previous failed attempts
		const delayMs = await rateLimiter.getProgressiveDelay(request);
		if (delayMs > 0) {
			await delay(delayMs);
		}

		// Authenticate user
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

			const loginUrl = new URL(constructUrl('/login'));
			loginUrl.searchParams.set('error', finalMessage);
			return NextResponse.redirect(loginUrl);
		}

		// Record successful login (clears failed attempts)
		await rateLimiter.recordAttempt(request, true);

		// Create session data
		const sessionData = JSON.stringify({
			username,
			loginTime: Date.now(),
		});

		const encryptedSessionData = encrypt(sessionData);

		// Redirect to home with session cookie
		const homeUrl = constructUrl('/');
		const response = NextResponse.redirect(homeUrl);
		response.cookies.set('session', encryptedSessionData, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7, // One week
			path: '/',
			sameSite: 'strict',
		});

		return response;
	} catch (error) {
		// Record failed attempt for server errors too
		await rateLimiter.recordAttempt(request, false);

		const loginUrl = new URL(constructUrl('/login'));
		loginUrl.searchParams.set('error', error instanceof Error ? error.message : 'Something went wrong.');
		return NextResponse.redirect(loginUrl);
	}
}
