import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
	// Clear the session cookie server-side
	const cookieStore = await cookies();
	cookieStore.delete('session');

	// Optionally call the logout API for any server-side cleanup
	try {
		await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/logout`, {
			method: 'POST',
		});
	} catch (error) {
		console.error('Logout API call failed:', error);
		// Continue with logout even if API fails
	}

	// Server-side redirect back to home
	return NextResponse.redirect(new URL('/', request.url));
}
