import { NextRequest, NextResponse } from 'next/server';
import { validateInvitationToken } from '@/lib/invitations/manager';

export async function GET(request: NextRequest) {
	try {
		// Get token from query parameters
		const searchParams = request.nextUrl.searchParams;
		const token = searchParams.get('token');

		if (!token) {
			return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
		}

		// Validate the invitation token
		const invitation = await validateInvitationToken(token);

		if (!invitation) {
			return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
		}

		// Return invitation details (but not the token itself for security)
		return NextResponse.json({
			valid: true,
			email: invitation.email,
			householdName: invitation.household_name,
			inviterName: invitation.inviter_name,
			expiresAt: invitation.expires_at,
		});
	} catch (error) {
		console.error('Validate invitation error:', error);
		return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
	}
}
