import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getAllUsers, getUserStats } from '@/lib/queries/admin/users';
import type { User } from '@/types/user';

async function handler(request: NextRequest) {
	try {
		const includeStats = request.nextUrl.searchParams.get('includeStats') === 'true';

		const users = await getAllUsers();

		const response: { users: User[]; stats?: { total: number; active: number; admins: number } } = { users };

		if (includeStats) {
			const stats = await getUserStats();
			response.stats = stats;
		}

		return NextResponse.json(response);
	} catch (error) {
		console.error('Error fetching users:', error);
		return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
	}
}

export const GET = withAuth(handler);
