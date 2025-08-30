'use client';

import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { SiFacebook } from 'react-icons/si';

export default function SignIn() {
	return (
		<div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 120px)' }}>
			<div className="max-w-md w-full">
				<div className="bg-surface border border-custom rounded-sm p-8">
					<div className="text-center mb-8">
						<h1 className="text-2xl text-foreground mb-2">Welcome to Family Foodie</h1>
						<p className="text-secondary">Sign in to start meal planning with your household</p>
					</div>

					<div className="space-y-3">
						<button
							onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
							className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-custom rounded-md bg-surface text-foreground hover:bg-muted transition-colors"
						>
							<FcGoogle size={20} />
							Continue with Google
						</button>

						<button
							onClick={() => signIn('facebook', { callbackUrl: '/dashboard' })}
							className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-custom rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
						>
							<SiFacebook size={20} />
							Continue with Facebook
						</button>
					</div>

					<div className="mt-8 text-center">
						<p className="text-xs text-muted">By signing in, you agree to our Terms of Service and Privacy Policy</p>
					</div>
				</div>
			</div>
		</div>
	);
}
