import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, getUserStats } from '@/lib/queries/admin/users';
import { requireAdminAuth } from '@/lib/auth/helpers';
import type { User } from '@/types/user';

export async function GET(request: NextRequest): Promise<NextResponse> {
	// Require admin permissions
	const auth = await requireAdminAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		// Parse URL correctly for query parameters
		const { searchParams } = new URL(request.url);
		const includeStats = searchParams.get('includeStats') === 'true';

		// Fetch all users
		let users: User[];
		try {
			users = await getAllUsers();
		} catch (error) {
			console.error('Failed to fetch users:', error);
			return NextResponse.json(
				{
					error: 'Failed to fetch users',
					code: 'DATABASE_ERROR',
				},
				{ status: 500 }
			);
		}

		// Build response
		const response: { users: User[]; stats?: { total: number; active: number; admins: number } } = { users };

		// Optionally include stats
		if (includeStats) {
			try {
				const stats = await getUserStats();
				response.stats = stats;
			} catch (error) {
				console.error('Failed to fetch user stats:', error);
				return NextResponse.json(
					{
						error: 'Failed to fetch users',
						code: 'STATS_FETCH_ERROR',
					},
					{ status: 500 }
				);
			}
		}

		return NextResponse.json(response);
	} catch (error) {
		console.error('Error in admin users handler:', error);
		return NextResponse.json(
			{
				error: 'Failed to fetch users',
				code: 'INTERNAL_ERROR',
			},
			{ status: 500 }
		);
	}
}
