'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';

interface InvitationData {
	valid: boolean;
	email: string;
	householdName: string;
	inviterName: string;
	expiresAt: string;
}

export default function InvitePage() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const { data: session, status } = useSession();
	const [invitation, setInvitation] = useState<InvitationData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	
	const token = searchParams.get('token');
	
	useEffect(() => {
		if (token) {
			validateInvitation();
		} else {
			setError('No invitation token provided');
			setLoading(false);
		}
	}, [token]);
	
	// If user is already signed in, redirect to home
	useEffect(() => {
		if (status === 'authenticated' && session?.user) {
			// The auth adapter will handle the invitation acceptance
			// based on the email match, so we just redirect home
			router.push('/');
		}
	}, [status, session, router]);
	
	const validateInvitation = async () => {
		try {
			const response = await fetch(`/api/invitations/validate?token=${token}`);
			const data = await response.json();
			
			if (!response.ok) {
				throw new Error(data.error || 'Invalid invitation');
			}
			
			setInvitation(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to validate invitation');
		} finally {
			setLoading(false);
		}
	};
	
	const handleSignIn = () => {
		// Store the token in session storage so we can access it after OAuth callback
		if (token) {
			sessionStorage.setItem('invitation_token', token);
		}
		
		// Sign in with Google - the auth adapter will handle the rest
		// based on email matching
		signIn('google', { callbackUrl: '/' });
	};
	
	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<div className="text-center">
					<div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
					<p className="text-secondary">Validating invitation...</p>
				</div>
			</div>
		);
	}
	
	if (error) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center px-4">
				<div className="max-w-md w-full">
					<div className="bg-surface border border-custom rounded-sm p-8 text-center">
						<div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
							<svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</div>
						<h1 className="text-xl font-semibold text-foreground mb-2">Invalid Invitation</h1>
						<p className="text-secondary mb-6">{error}</p>
						<button
							onClick={() => router.push('/')}
							className="px-4 py-2 bg-accent text-background rounded-sm hover:bg-accent/90 transition-colors"
						>
							Go to Home
						</button>
					</div>
				</div>
			</div>
		);
	}
	
	if (!invitation) {
		return null;
	}
	
	return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4">
			<div className="max-w-md w-full">
				<div className="bg-surface border border-custom rounded-sm p-8">
					{/* Header */}
					<div className="text-center mb-8">
						<div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
							<svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
							</svg>
						</div>
						<h1 className="text-2xl font-semibold text-foreground mb-2">You're Invited!</h1>
						<p className="text-secondary">
							<strong>{invitation.inviterName}</strong> has invited you to join
						</p>
					</div>
					
					{/* Household Info */}
					<div className="bg-background border border-custom rounded-sm p-4 mb-6">
						<p className="text-sm text-secondary mb-1">Household</p>
						<p className="text-lg font-medium text-foreground">{invitation.householdName}</p>
					</div>
					
					{/* Email Info */}
					<div className="mb-6">
						<p className="text-sm text-secondary text-center">
							This invitation was sent to <strong className="text-foreground">{invitation.email}</strong>
						</p>
					</div>
					
					{/* Sign In Button */}
					<button
						onClick={handleSignIn}
						className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-custom rounded-sm bg-surface text-foreground hover:bg-muted transition-colors"
					>
						<FcGoogle size={20} />
						Continue with Google to Accept
					</button>
					
					{/* Info Text */}
					<p className="text-xs text-secondary text-center mt-4">
						By accepting this invitation, you'll join the {invitation.householdName} household
						for shared meal planning on Family Foodie.
					</p>
					
					{/* Expiration Notice */}
					<p className="text-xs text-muted text-center mt-4">
						This invitation expires on {new Date(invitation.expiresAt).toLocaleDateString()}
					</p>
				</div>
			</div>
		</div>
	);
}