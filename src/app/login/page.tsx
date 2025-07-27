'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
	const router = useRouter();
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setError('');

		const formData = new FormData(event.currentTarget);
		const username = formData.get('username');
		const password = formData.get('password');

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});

			const data = await response.json();

			if (data.success) {
				// Dispatch custom event to notify header about login
				window.dispatchEvent(new CustomEvent('userLogin'));

				// Redirect to home
				router.push('/');
			} else {
				// Handle rate limiting and other errors
				if (response.status === 429) {
					const retryAfter = data.retryAfter || 1800;
					const minutes = Math.ceil(retryAfter / 60);
					setError(`Too many failed attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`);
				} else {
					setError(data.error || 'Login failed');
				}
			}
		} catch (e) {
			setError(`Network error: ${e instanceof Error ? e.message : 'Unknown error'}`);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-[calc(100vh-120px)] bg-background flex items-center justify-center px-4 py-8">
			<div className="w-full max-w-md">
				{/* Header */}
				<div className="text-center mb-8">
					<p className="text-muted mt-2">Welcome back! Please login to your account.</p>
				</div>

				{/* Login Form */}
				<div className="bg-surface border border-custom rounded-lg shadow-sm p-8">
					<form onSubmit={handleSubmit} className="space-y-6">
						{/* Username Field */}
						<div>
							<label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
								Username
							</label>
							<input
								type="text"
								id="username"
								name="username"
								placeholder="Enter your username"
								required
								disabled={loading}
								className="w-full px-4 py-3 border border-custom rounded-lg bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							/>
						</div>

						{/* Password Field */}
						<div>
							<label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
								Password
							</label>
							<input
								type="password"
								id="password"
								name="password"
								placeholder="Enter your password"
								required
								disabled={loading}
								className="w-full px-4 py-3 border border-custom rounded-lg bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							/>
						</div>

						{/* Error Message */}
						{error && (
							<div className="bg-red-50 border border-red-200 rounded-lg p-4">
								<div className="flex items-center">
									<svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
										<path
											fillRule="evenodd"
											d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
											clipRule="evenodd"
										/>
									</svg>
									<p className="text-red-700 text-sm">{error}</p>
								</div>
							</div>
						)}

						{/* Submit Button */}
						<button
							type="submit"
							disabled={loading}
							className="w-full bg-accent text-background py-3 px-4 rounded-lg font-medium text-base hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{loading ? (
								<div className="flex items-center justify-center">
									<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-background" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										></path>
									</svg>
									Logging In...
								</div>
							) : (
								'Login'
							)}
						</button>
					</form>

					{/* Additional Links */}
					<div className="mt-6 text-center">
						<p className="text-sm text-muted">
							Don&apos;t have an account?{' '}
							<a href="#" className="text-accent hover:text-accent/80 font-medium transition-colors">
								Contact administrator
							</a>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
