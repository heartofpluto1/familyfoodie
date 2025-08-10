import { ErrorIconSmall } from '@/app/components/Icons';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

interface LoginPageProps {
	searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
	// Redirect if already authenticated
	const session = await getSession();
	if (session) {
		redirect('/');
	}

	// Get error from URL params (from failed login attempts)
	const { error } = await searchParams;

	return (
		<div className="min-h-[calc(100vh-120px)] bg-background flex items-center justify-center px-4 py-8">
			<div className="w-full max-w-md">
				{/* Header */}
				<div className="text-center mb-8">
					<p className="text-muted mt-2">Welcome back! Please login to your account.</p>
				</div>

				{/* Login Form */}
				<div className="bg-surface border border-custom rounded-sm shadow-sm p-8">
					<form action="/login/submit" method="POST" className="space-y-6">
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
								autoComplete="username"
								className="w-full px-4 py-3 border border-custom rounded-sm bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
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
								autoComplete="current-password"
								className="w-full px-4 py-3 border border-custom rounded-sm bg-background text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
							/>
						</div>

						{/* Error Message */}
						{error && (
							<div className="bg-red-50 border border-red-200 rounded-sm p-4">
								<div className="flex items-center">
									<ErrorIconSmall />
									<p className="text-red-700 text-sm">{error}</p>
								</div>
							</div>
						)}

						{/* Submit Button */}
						<button
							type="submit"
							className="w-full bg-accent text-background py-3 px-4 rounded-sm font-medium text-base hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-colors"
						>
							Login
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
