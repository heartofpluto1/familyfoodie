import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser } from '@/lib/queries/admin/users';
import type { UserUpdate } from '@/types/user';
import { requireAdminAuth } from '@/lib/auth/helpers';

interface RouteParams {
	params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	const auth = await requireAdminAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const { id } = await params;
		const userId = parseInt(id, 10);

		if (isNaN(userId)) {
			return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
		}

		const userData = await getUserById(userId);

		if (!userData) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		return NextResponse.json({ user: userData });
	} catch {
		return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
	const auth = await requireAdminAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const { id } = await params;
		const userId = parseInt(id, 10);

		if (isNaN(userId)) {
			return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
		}

		const updates: UserUpdate = await request.json();

		// Prevent users from modifying their own privileges
		if (userId === parseInt(auth.user_id) && (updates.is_admin !== undefined || updates.is_active !== undefined)) {
			return NextResponse.json({ error: 'Cannot modify your own privileges' }, { status: 400 });
		}

		const result = await updateUser(userId, updates);

		if (!result) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		const updatedUser = await getUserById(userId);

		return NextResponse.json({
			message: 'User updated successfully',
			user: updatedUser,
		});
	} catch {
		return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
	const auth = await requireAdminAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const { id } = await params;
		const userId = parseInt(id, 10);

		if (isNaN(userId)) {
			return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
		}

		// Prevent self-deletion
		if (userId === parseInt(auth.user_id)) {
			return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
		}

		const result = await deleteUser(userId);

		if (!result) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		return NextResponse.json({
			message: 'User deleted successfully',
		});
	} catch {
		return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
	}
}
