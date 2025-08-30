import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { requireAuth } from '@/lib/auth/helpers';
import { RowDataPacket } from 'mysql2';

interface UserValidationRow extends RowDataPacket {
	id: number;
}

interface HouseholdMemberRow extends RowDataPacket {
	first_name: string;
	last_name: string;
}

interface PendingInvitationRow extends RowDataPacket {
	email: string;
}

export async function GET(): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		// Validate that the user belongs to the household they're requesting data for
		const [userValidation] = await pool.execute<UserValidationRow[]>(`SELECT id FROM users WHERE id = ? AND household_id = ?`, [
			auth.user_id,
			auth.household_id,
		]);

		if (!userValidation || userValidation.length === 0) {
			return NextResponse.json({ error: 'User not authorized for this household' }, { status: 403 });
		}

		// Fetch household members
		const [householdMembers] = await pool.execute<HouseholdMemberRow[]>(
			`SELECT first_name, last_name 
			 FROM users 
			 WHERE household_id = ? 
			 ORDER BY first_name ASC, last_name ASC`,
			[auth.household_id]
		);

		// Fetch pending invitations for this household
		const [pendingInvitations] = await pool.execute<PendingInvitationRow[]>(
			`SELECT email 
			 FROM household_invitations 
			 WHERE household_id = ? 
			 AND accepted_at IS NULL 
			 AND declined_at IS NULL 
			 AND expires_at > NOW()
			 ORDER BY created_at DESC`,
			[auth.household_id]
		);

		// Combine active members and pending invitations
		const allMembers = [
			...householdMembers.map(member => `${member.first_name} ${member.last_name}`.trim()),
			...pendingInvitations.map(invitation => `${invitation.email} (pending)`),
		];

		return NextResponse.json({
			household_name: auth.session.user.household_name || null,
			members: allMembers,
		});
	} catch (error) {
		console.error('Error fetching household members:', error);
		return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
	}
}
