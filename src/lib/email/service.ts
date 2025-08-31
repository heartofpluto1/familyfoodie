import { Resend } from 'resend';

interface SendInvitationEmailParams {
	recipientEmail: string;
	inviterName: string;
	householdName: string;
	inviteToken: string;
	expiresAt: Date;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
	const inviteUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/invite?token=${params.inviteToken}`;

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Invitation to Family Foodie</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="background: linear-gradient(to right, #4F46E5, #7C3AED); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
				<h1 style="color: white; margin: 0; font-size: 28px;">Family Foodie</h1>
				<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">What the fork is for dinner?</p>
			</div>
			
			<div style="background: white; padding: 40px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
				<h2 style="color: #1a1a1a; margin-top: 0;">You're Invited!</h2>
				
				<p style="font-size: 16px; color: #4a4a4a;">
					<strong>${params.inviterName}</strong> has invited you to join their household 
					<strong>"${params.householdName}"</strong> on Family Foodie for shared meal planning and grocery lists.
				</p>
				
				<div style="margin: 30px 0; text-align: center;">
					<a href="${inviteUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
						Accept Invitation
					</a>
				</div>
				
				<p style="font-size: 14px; color: #6a6a6a; margin-top: 30px;">
					Or copy and paste this link into your browser:<br>
					<a href="${inviteUrl}" style="color: #4F46E5; word-break: break-all;">${inviteUrl}</a>
				</p>
				
				<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
				
				<p style="font-size: 12px; color: #999; text-align: center;">
					This invitation expires on ${params.expiresAt.toLocaleDateString('en-US', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
					})}.
				</p>
			</div>
		</body>
		</html>
	`;

	const text = `
You're Invited to Family Foodie!

${params.inviterName} has invited you to join their household "${params.householdName}" on Family Foodie for shared meal planning and grocery lists.

Accept the invitation by clicking this link:
${inviteUrl}

This invitation expires on ${params.expiresAt.toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})}.

Thanks,
The Family Foodie Team
	`;

	try {
		// If no API key is configured, log the email instead (for development)
		if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'development') {
			console.log('📧 Email would be sent to:', params.recipientEmail);
			console.log('Invitation URL:', inviteUrl);
			return { success: true, messageId: 'dev-mode' };
		}

		// Initialize Resend with API key only when we have one
		const resend = new Resend(process.env.RESEND_API_KEY);

		// Use Resend's default email until domain is verified
		const fromEmail = 'Family Foodie <onboarding@resend.dev>';

		console.log('Attempting to send email:', {
			from: fromEmail,
			to: params.recipientEmail,
			apiKeyLength: process.env.RESEND_API_KEY?.length || 0,
		});

		const response = await resend.emails.send({
			from: fromEmail,
			to: [params.recipientEmail],
			subject: `${params.inviterName} invited you to join ${params.householdName} on Family Foodie`,
			html,
			text,
		});

		if (!response.data) {
			console.error('Resend API response:', response);
			if (response.error) {
				console.error('Resend API error:', response.error);
				throw new Error(`Resend API error: ${response.error.message || response.error.name || 'Unknown error'}`);
			}
			throw new Error('Failed to send email - no response data');
		}

		return { success: true, messageId: response.data.id };
	} catch (error) {
		console.error('Failed to send invitation email:', error);
		if (error instanceof Error) {
			throw error; // Re-throw with original message for better debugging
		}
		throw new Error('Failed to send invitation email');
	}
}
