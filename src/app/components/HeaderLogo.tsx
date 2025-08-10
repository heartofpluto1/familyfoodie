'use client';

import Link from 'next/link';
import { Crimson_Text } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LogoutIcon } from './Icons';

const crimsonText = Crimson_Text({
	subsets: ['latin'],
	weight: ['400', '600', '700'],
	display: 'swap',
});

const HeaderLogo = () => {
	const { user, loading, isAuthenticated } = useAuth();
	const router = useRouter();

	// Handle logout button click
	const handleLogoutClick = async (e: React.MouseEvent) => {
		e.preventDefault();

		try {
			const response = await fetch('/api/auth/logout', {
				method: 'POST',
			});

			const data = await response.json();

			if (data.success) {
				// Dispatch custom event - context will handle the rest
				window.dispatchEvent(new CustomEvent('userLogout'));
				router.push('/');
			} else {
				console.error('Logout failed:', data.error);
				// Even if API fails, dispatch event
				window.dispatchEvent(new CustomEvent('userLogout'));
				router.push('/');
			}
		} catch (error) {
			console.error('Logout failed:', error);
			// Even if the API call fails, dispatch event
			window.dispatchEvent(new CustomEvent('userLogout'));
			router.push('/');
		}
	};

	return (
		<header className="bg-surface border-b border-custom">
			<div className="container mx-auto px-4 py-4">
				<div className="flex items-center justify-between">
					{/* Title Section */}
					<div>
						<h1 className={`${crimsonText.className} font-bold text-2xl md:text-3xl text-foreground tracking-wide`}>Family Foodie</h1>
						<p className="text-sm text-muted font-light italic">What the fork is for dinner?</p>
					</div>

					{/* Navigation and Auth */}
					<div className="flex items-center space-x-6">
						{/* Navigation - only show when authenticated */}
						{isAuthenticated && (
							<nav>
								<div className="flex space-x-6">
									<Link href="/" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline">
										Home
									</Link>
									<Link href="/plan" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline">
										Plan
									</Link>
									<Link href="/shop" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline">
										Shop
									</Link>
									<Link
										href="/recipes"
										className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline"
									>
										Recipes
									</Link>
									<Link href="/#" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline">
										Ingredients
									</Link>
								</div>
							</nav>
						)}

						{/* Auth Section */}
						<div className={isAuthenticated ? 'border-l border-custom pl-4' : ''}>
							{loading ? (
								<div className="text-sm text-secondary">...</div>
							) : isAuthenticated ? (
								<div className="flex items-center space-x-3">
									<span className="text-sm text-foreground">{user?.username}</span>
									<button
										onClick={handleLogoutClick}
										className="bg-accent text-background p-2 rounded-md hover:bg-accent/90 transition-colors"
										title="Logout"
									>
										<LogoutIcon />
									</button>
								</div>
							) : (
								<Link href="/login" className="bg-accent text-background px-4 py-2 rounded-md text-sm font-medium hover:bg-accent/90 transition-colors">
									Login
								</Link>
							)}
						</div>
					</div>
				</div>
			</div>
		</header>
	);
};

export default HeaderLogo;
