import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { createInvitation, checkInvitationRateLimit } from '@/lib/invitations/manager';
import { sendInvitationEmail } from '@/lib/email/service';

export async function POST(request: NextRequest) {
	try {
		// Check authentication
		const auth = await requireAuth();
		if (!auth.authorized) {
			return auth.response;
		}
		
		// Parse request body
		const body = await request.json();
		const { email } = body;
		
		// Validate email
		if (!email || typeof email !== 'string') {
			return NextResponse.json(
				{ error: 'Email is required' },
				{ status: 400 }
			);
		}
		
		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return NextResponse.json(
				{ error: 'Invalid email address' },
				{ status: 400 }
			);
		}
		
		// Check if user is trying to invite themselves
		if (email.toLowerCase() === auth.session.user.email?.toLowerCase()) {
			return NextResponse.json(
				{ error: 'You cannot invite yourself' },
				{ status: 400 }
			);
		}
		
		// Check rate limiting
		const canSendInvitation = await checkInvitationRateLimit(parseInt(auth.user_id));
		if (!canSendInvitation) {
			return NextResponse.json(
				{ error: 'Too many invitations sent. Please try again later.' },
				{ status: 429 }
			);
		}
		
		// Create the invitation
		const invitation = await createInvitation({
			email: email.toLowerCase(),
			householdId: auth.household_id,
			invitedByUserId: parseInt(auth.user_id)
		});
		
		// Send the invitation email
		await sendInvitationEmail({
			recipientEmail: email,
			inviterName: auth.session.user.name || 'A Family Foodie member',
			householdName: auth.session.user.household_name,
			inviteToken: invitation.inviteToken,
			expiresAt: invitation.expiresAt
		});
		
		return NextResponse.json({
			success: true,
			message: 'Invitation sent successfully',
			expiresAt: invitation.expiresAt
		});
		
	} catch (error) {
		console.error('Send invitation error:', error);
		
		// Generic error response to prevent email enumeration
		// Log the actual error server-side but don't reveal it to the client
		if (error instanceof Error && error.message === 'Cannot send invitation') {
			// This is an expected business logic failure (already member or pending invitation)
			// Return generic message to prevent email enumeration
			return NextResponse.json(
				{ error: 'Cannot send invitation to this email address' },
				{ status: 400 }
			);
		}
		
		// Unexpected server errors
		return NextResponse.json(
			{ error: 'Failed to send invitation' },
			{ status: 500 }
		);
	}
}