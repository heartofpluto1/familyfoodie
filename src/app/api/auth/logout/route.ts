// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Prevent static generation

export async function POST() {
	try {
		// Create response
		const response = NextResponse.json({
			success: true,
			message: 'Logged out successfully',
		});

		// Clear the session cookie by setting it to expire immediately
		response.cookies.set('session', '', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			maxAge: 0, // Expire immediately
			path: '/',
			sameSite: 'strict',
		});

		return response;
	} catch (error) {
		console.error('Logout API error:', error);
		return NextResponse.json({ success: false, error: 'Something went wrong.' }, { status: 500 });
	}
}

// Also support GET requests for direct navigation to logout
export async function GET(request: NextRequest) {
	try {
		// Redirect to home page after logout
		const response = NextResponse.redirect(new URL('/', request.url));

		// Clear the session cookie
		response.cookies.set('session', '', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			maxAge: 0,
			path: '/',
			sameSite: 'strict',
		});

		return response;
	} catch (error) {
		console.error('Logout API error:', error);
		// Still redirect even if there's an error
		return NextResponse.redirect(new URL('/', request.url));
	}
}
