import Link from 'next/link';
import { Crimson_Text } from 'next/font/google';
import { LogoutIcon } from './Icons';
import type { SessionData } from '@/types/auth';

const crimsonText = Crimson_Text({
	subsets: ['latin'],
	weight: ['400', '600', '700'],
	display: 'swap',
});

interface HeaderLogoProps {
	session: SessionData | null;
}

const HeaderLogo = ({ session }: HeaderLogoProps) => {
	const isAuthenticated = !!session;
	const user = session;

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
							{isAuthenticated ? (
								<div className="flex items-center space-x-3">
									<span className="text-sm text-foreground">{user?.username}</span>
									<Link
										href="/logout"
										prefetch={false}
										className="bg-accent text-background p-2 rounded-md hover:bg-accent/90 transition-colors inline-block"
										title="Logout"
									>
										<LogoutIcon />
									</Link>
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
