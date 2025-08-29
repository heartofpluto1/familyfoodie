import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { RowDataPacket } from 'mysql2';

interface UserValidationRow extends RowDataPacket {
	id: number;
}

interface HouseholdMemberRow extends RowDataPacket {
	username: string;
}

async function handler(request: AuthenticatedRequest) {
	try {
		// Validate that the user belongs to the household they're requesting data for
		const [userValidation] = await pool.execute<UserValidationRow[]>(`SELECT id FROM users WHERE id = ? AND household_id = ?`, [
			request.user.id,
			request.household_id,
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
			[request.household_id]
		);

		return NextResponse.json({
			household_name: request.user.household_name || null,
			members: householdMembers.map(member => member.username),
		});
	} catch (error) {
		console.error('Error fetching household members:', error);
		return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
	}
}

export const GET = withAuth(handler);
