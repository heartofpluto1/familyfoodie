'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

const HeaderLogo = () => {
	const { data: session } = useSession();
	const isAuthenticated = !!session;

	return (
		<header className="bg-surface border-b border-custom">
			<div className="container mx-auto px-4 py-3 md:py-4">
				<div className="flex items-center justify-between">
					{/* Title Section */}
					<div className="min-w-0 flex-shrink">
						<h1 className="text-xl sm:text-2xl md:text-3xl text-foreground tracking-wide">Family Foodie</h1>
						<p className="text-sm text-muted font-light italic">What the fork is for dinner?</p>
					</div>

					{/* Navigation - only show when authenticated */}
					{isAuthenticated && (
						<nav className="hidden sm:block">
							<div className="flex space-x-3 md:space-x-6">
								<Link
									href="/"
									className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline text-sm md:text-base"
								>
									Home
								</Link>
							</div>
						</nav>
					)}

					{/* Auth Section */}
					<div className={isAuthenticated ? 'border-l border-custom pl-2 sm:pl-4' : ''}>
						{isAuthenticated ? (
							<div className="flex items-center space-x-2 sm:space-x-3">
								<div className="text-right">
									<div className="text-xs sm:text-sm text-foreground">{session?.user?.name}</div>
									{session?.user?.household_name && <div className="text-xs text-muted">{session.user.household_name}</div>}
								</div>
								<button
									onClick={() => signOut()}
									className="bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-sm text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors"
								>
									Sign Out
								</button>
							</div>
						) : (
							<Link
								href="/auth/signin"
								className="bg-accent text-background px-3 py-1.5 sm:px-4 sm:py-2 rounded-sm text-xs sm:text-sm font-medium hover:bg-accent/90 transition-colors"
							>
								Sign In
							</Link>
						)}
					</div>
				</div>
			</div>
		</header>
	);
};

export default HeaderLogo;
