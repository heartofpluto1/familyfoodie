'use client';

import Link from 'next/link';
import { LogoutIcon, BurgerIcon } from './Icons';
import type { SessionData } from '@/types/auth';
import { useRef, useEffect } from 'react';

interface HeaderLogoProps {
	session: SessionData | null;
}

const HeaderLogo = ({ session }: HeaderLogoProps) => {
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const isAuthenticated = !!session;
	const user = session;

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
						<h1 className="text-xl sm:text-2xl md:text-3xl text-foreground tracking-wide">Family Foodie</h1>
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
										href="/recipe"
										className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline text-sm md:text-base"
									>
										Recipes
									</Link>
									<Link
										href="/ingredients"
										className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline text-sm md:text-base hidden md:inline"
									>
										Ingredients
									</Link>
								</div>
							</nav>
						)}

						{/* Mobile Navigation Menu - show only on small screens when authenticated */}
						{isAuthenticated && (
							<nav className="sm:hidden">
								<details ref={detailsRef} className="relative">
									<summary className="list-none cursor-pointer bg-surface border border-custom rounded-sm p-2 text-foreground hover:bg-accent/10 transition-colors flex items-center justify-center">
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
											href="/recipe"
											className="block px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-accent/10 transition-colors"
										>
											Recipes
										</Link>
										<Link
											href="/ingredients"
											className="block px-3 py-2 text-sm text-secondary hover:text-foreground hover:bg-accent/10 transition-colors"
										>
											Ingredients
										</Link>
									</div>
								</details>
							</nav>
						)}

						{/* Auth Section */}
						<div className={isAuthenticated ? 'border-l border-custom pl-2 sm:pl-4' : ''}>
							{isAuthenticated ? (
								<div className="flex items-center space-x-2 sm:space-x-3">
									<span className="text-xs sm:text-sm text-foreground xs:inline">{user?.username}</span>
									<Link
										href="/logout"
										prefetch={false}
										className="bg-accent text-background p-1.5 sm:p-2 rounded-sm hover:bg-accent/90 transition-colors inline-block"
										title="Logout"
									>
										<LogoutIcon className="w-4 h-4 sm:w-5 sm:h-5" />
									</Link>
								</div>
							) : (
								<Link
									href="/login"
									className="bg-accent text-background px-3 py-1.5 sm:px-4 sm:py-2 rounded-sm text-xs sm:text-sm font-medium hover:bg-accent/90 transition-colors"
								>
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
