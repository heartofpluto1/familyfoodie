import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { requireAuth } from '@/lib/auth/helpers';
import { RowDataPacket } from 'mysql2';

interface UserValidationRow extends RowDataPacket {
	id: number;
}

interface HouseholdMemberRow extends RowDataPacket {
	username: string;
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
			`SELECT username 
			 FROM users 
			 WHERE household_id = ? 
			 ORDER BY username ASC`,
			[auth.household_id]
		);

		return NextResponse.json({
			household_name: auth.session.user.household_name || null,
			members: householdMembers.map(member => member.username),
		});
	} catch (error) {
		console.error('Error fetching household members:', error);
		return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
	}
}
