import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getAllUsers, getUserStats } from '@/lib/queries/admin/users';
import { requireAdminUser } from '@/lib/auth-helpers';
import type { User } from '@/types/user';

// Define the context type expected by Next.js App Router
type RouteContext = {
	params: Promise<Record<string, string | string[]>>;
};

async function handler(request: NextRequest, _context: RouteContext) {
	try {
		// Require admin permissions
		const adminUser = await requireAdminUser(request);
		if (!adminUser) {
			return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
		}

		const includeStats = request.nextUrl.searchParams.get('includeStats') === 'true';

		const users = await getAllUsers();

		const response: { users: User[]; stats?: { total: number; active: number; admins: number } } = { users };

		if (includeStats) {
			const stats = await getUserStats();
			response.stats = stats;
		}

		return NextResponse.json(response);
	} catch {
		return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
	}
}

export const GET = withAuth(handler);
