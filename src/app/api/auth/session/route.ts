// app/api/auth/session/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
	try {
		const session = await getSession();

		if (!session) {
			return NextResponse.json(
				{
					success: false,
					message: 'Not authenticated',
				},
				{ status: 401 }
			);
		}

		return NextResponse.json({
			success: true,
			user: {
				username: session.username,
				userId: session.userId,
				loginTime: session.loginTime,
			},
		});
	} catch (error) {
		console.error('Session check error:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Failed to check session',
			},
			{ status: 500 }
		);
	}
}
