import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getAllUsers, getUserStats } from '@/lib/queries/admin/users';
import { requireAdminUser } from '@/lib/auth-helpers';
import type { User } from '@/types/user';

async function handler(request: NextRequest) {
	try {
		// Require admin permissions
		const adminUser = await requireAdminUser(request);
		if (!adminUser) {
			return NextResponse.json(
				{
					error: 'Admin access required',
					code: 'ADMIN_ACCESS_REQUIRED',
				},
				{ status: 403 }
			);
		}

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

export const GET = withAuth(handler);
