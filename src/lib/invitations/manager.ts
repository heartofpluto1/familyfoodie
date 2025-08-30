import crypto from 'crypto';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

interface CreateInvitationParams {
	email: string;
	householdId: number;
	invitedByUserId: number;
}

interface InvitationRow extends RowDataPacket {
	id: number;
	email: string;
	household_id: number;
	invited_by_user_id: number;
	invite_token: string;
	expires_at: Date;
	created_at: Date;
	accepted_at: Date | null;
	declined_at: Date | null;
	household_name?: string;
	inviter_name?: string;
}

export async function createInvitation(params: CreateInvitationParams) {
	// Generate secure random token (URL-safe)
	const inviteToken = crypto.randomBytes(32).toString('base64url');
	
	// Set expiration to 7 days from now
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	
	// Check if user is already in the household
	const [existingMembers] = await pool.execute<RowDataPacket[]>(
		'SELECT id FROM users WHERE email = ? AND household_id = ?',
		[params.email, params.householdId]
	);
	
	if (existingMembers.length > 0) {
		throw new Error('Cannot send invitation');
	}
	
	// Check if invitation already exists for this email/household
	const [existingInvitations] = await pool.execute<RowDataPacket[]>(
		`SELECT id FROM household_invitations 
		 WHERE email = ? AND household_id = ? 
		 AND expires_at > NOW() AND accepted_at IS NULL AND declined_at IS NULL`,
		[params.email, params.householdId]
	);
	
	if (existingInvitations.length > 0) {
		throw new Error('Cannot send invitation');
	}
	
	// Insert invitation record
	const [result] = await pool.execute<ResultSetHeader>(
		`INSERT INTO household_invitations 
		 (email, household_id, invited_by_user_id, invite_token, expires_at)
		 VALUES (?, ?, ?, ?, ?)`,
		[params.email, params.householdId, params.invitedByUserId, inviteToken, expiresAt]
	);
	
	return {
		invitationId: result.insertId,
		inviteToken,
		expiresAt
	};
}

export async function validateInvitationToken(token: string): Promise<InvitationRow | null> {
	const [rows] = await pool.execute<InvitationRow[]>(
		`SELECT hi.*, h.name as household_name, 
		        CONCAT(u.first_name, ' ', u.last_name) as inviter_name
		 FROM household_invitations hi
		 JOIN households h ON hi.household_id = h.id
		 JOIN users u ON hi.invited_by_user_id = u.id
		 WHERE hi.invite_token = ? 
		 AND hi.expires_at > NOW() 
		 AND hi.accepted_at IS NULL 
		 AND hi.declined_at IS NULL`,
		[token]
	);
	
	return rows[0] || null;
}

export async function getPendingInvitations(email: string): Promise<InvitationRow[]> {
	const [rows] = await pool.execute<InvitationRow[]>(
		`SELECT hi.*, h.name as household_name,
		        CONCAT(u.first_name, ' ', u.last_name) as inviter_name
		 FROM household_invitations hi
		 JOIN households h ON hi.household_id = h.id
		 JOIN users u ON hi.invited_by_user_id = u.id
		 WHERE hi.email = ? 
		 AND hi.expires_at > NOW() 
		 AND hi.accepted_at IS NULL 
		 AND hi.declined_at IS NULL
		 ORDER BY hi.created_at DESC`,
		[email]
	);
	
	return rows;
}

export async function markInvitationAccepted(token: string) {
	await pool.execute(
		'UPDATE household_invitations SET accepted_at = NOW() WHERE invite_token = ?',
		[token]
	);
}

export async function markInvitationDeclined(token: string) {
	await pool.execute(
		'UPDATE household_invitations SET declined_at = NOW() WHERE invite_token = ?',
		[token]
	);
}

// Check rate limiting for invitation sending
export async function checkInvitationRateLimit(userId: number): Promise<boolean> {
	// Check if user has sent more than 10 invitations in the last hour
	const [rows] = await pool.execute<RowDataPacket[]>(
		`SELECT COUNT(*) as count 
		 FROM household_invitations 
		 WHERE invited_by_user_id = ? 
		 AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
		[userId]
	);
	
	return rows[0].count < 10;
}