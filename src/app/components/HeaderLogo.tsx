'use client';

import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { LogoutIcon, BurgerIcon } from './Icons';
import { useRef, useEffect, useState } from 'react';
import UserSettings from './UserSettings';
import type { Session } from 'next-auth';

interface HeaderLogoProps {
	session: Session | null;
}

const HeaderLogo = ({ session }: HeaderLogoProps) => {
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
	const isAuthenticated = !!session;

	const closeMenu = () => {
		if (detailsRef.current) {
			detailsRef.current.open = false;
		}
	};

	useEffect(() => {
		const handleAnyClick = (event: MouseEvent) => {
			if (detailsRef.current && detailsRef.current.open) {
				// Close menu on any click, except on the summary button itself
				if (!detailsRef.current.querySelector('summary')?.contains(event.target as Node)) {
					closeMenu();
				}
			}
		};

		document.addEventListener('click', handleAnyClick);
		return () => {
			document.removeEventListener('click', handleAnyClick);
		};
	}, []);

	return (
		<header className="bg-surface border-b border-custom">
			<div className="container mx-auto px-4 py-3 md:py-4">
				<div className="flex items-center justify-between">
					{/* Title Section */}
					<div className="min-w-0 flex-shrink">
						<h1 className="text-xl sm:text-2xl md:text-3xl text-foreground tracking-wide flex items-center gap-2">
							Family Foodie
							<span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-sm font-medium">BETA</span>
						</h1>
						<p className="text-sm text-muted font-light italic">What the fork is for dinner?</p>
					</div>

					{/* Navigation and Auth */}
					<div className="flex items-center space-x-2 sm:space-x-4 md:space-x-6">
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
									<Link
										href="/plan"
										className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline text-sm md:text-base"
									>
										Plan
									</Link>
									<Link
										href="/shop"
										className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline text-sm md:text-base"
									>
										Shop
									</Link>
									<Link
										href="/recipes"
										className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline text-sm md:text-base"
									>
										Recipes
									</Link>
									{session?.user?.is_admin && (
										<Link
											href="/admin"
											className="transition-colors font-medium underline-offset-4 hover:underline text-sm md:text-base hidden lg:inline"
										>
											Admin
										</Link>
									)}
								</div>
							</nav>
						)}

						{/* Mobile Navigation Menu - show only on small screens when authenticated */}
						{isAuthenticated && (
							<nav className="sm:hidden">
								<details ref={detailsRef} className="relative">
									<summary className="list-none cursor-pointer bg-surface border border-custom rounded-sm p-2 text-foreground hover:bg-accent/10 transition-colors flex items-center justify-center [&::-webkit-details-marker]:hidden">
										<BurgerIcon className="w-4 h-4" />
									</summary>
									<div className="absolute right-0 top-full mt-1 bg-surface border border-custom rounded-sm shadow-lg min-w-24 z-50">
										<Link href="/" className="block px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-accent/10 transition-colors">
											Home
										</Link>
										<Link href="/plan" className="block px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-accent/10 transition-colors">
											Plan
										</Link>
										<Link href="/shop" className="block px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-accent/10 transition-colors">
											Shop
										</Link>
										<Link
											href="/recipes"
											className="block px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-accent/10 transition-colors"
										>
											Recipes
										</Link>
										{session?.user?.is_admin && (
											<Link href="/admin" className="block px-3 py-2 text-sm transition-colors">
												Admin
											</Link>
										)}
									</div>
								</details>
							</nav>
						)}

						{/* Auth Section */}
						<div className={isAuthenticated ? 'border-l border-custom pl-2 sm:pl-4' : ''}>
							{isAuthenticated ? (
								<div className="flex items-center space-x-2 sm:space-x-3">
									<button
										onClick={() => setIsUserSettingsOpen(true)}
										className="flex items-center justify-center cursor-pointer"
										title="User settings"
									>
										{session?.user?.image ? (
											<Image
												src={session.user.image}
												alt={session.user.name || 'User'}
												width={36}
												height={36}
												className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-custom"
												unoptimized
											/>
										) : (
											<div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-accent text-background flex items-center justify-center text-sm font-medium">
												{session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
											</div>
										)}
									</button>
									<button onClick={() => signOut({ callbackUrl: '/' })} className="btn-default p-1.5 sm:p-2 rounded-sm inline-block" title="Sign Out">
										<LogoutIcon className="w-4 h-4 sm:w-5 sm:h-5" />
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
			</div>

			{/* User Settings Panel */}
			<UserSettings isOpen={isUserSettingsOpen} onClose={() => setIsUserSettingsOpen(false)} />
		</header>
	);
};

export default HeaderLogo;
