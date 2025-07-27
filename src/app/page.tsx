'use client';

import HeaderPage from '@/app/components/HeaderPage';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Stats, Meal, Menu } from '@/types/menus';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
	const { user, isAuthenticated, loading: authLoading } = useAuth();
	const [plans, setPlans] = useState([]);
	const [stats, setStats] = useState<Stats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch meal plans when authenticated
	useEffect(() => {
		async function fetchPlans() {
			if (!isAuthenticated) {
				setPlans([]);
				setStats(null);
				setLoading(false);
				return;
			}

			try {
				setLoading(true);
				const response = await fetch('/api/menus');
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				if (!data.success) {
					throw new Error(`Database error! status: ${data.error}`);
				}
				setPlans(data.data);
				setStats(data.stats);
				setError(null);
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
				setPlans([]);
				setStats(null);
			} finally {
				setLoading(false);
			}
		}

		// Only fetch plans when auth loading is complete
		if (!authLoading) {
			fetchPlans();
		}
	}, [isAuthenticated, authLoading]);

	// Show loading while auth is being checked
	if (authLoading || loading) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					<div className="flex items-center justify-center h-64">
						<p className="text-secondary">Loading...</p>
					</div>
				</div>
			</div>
		);
	}

	// Not authenticated - show welcome/login prompt
	if (!isAuthenticated) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					<div className="max-w-2xl mx-auto text-center">
						<div className="bg-surface border border-custom rounded-lg p-8 mb-8">
							<h2 className="text-xl font-semibold text-foreground mb-4">Login to view your meal plans</h2>
							<p className="text-secondary mb-6">
								Access your personalized meal planning dashboard, view your recipe collection, and track your weekly meal stats.
							</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
							<div className="bg-surface border border-custom rounded-lg p-6">
								<div className="text-accent mb-3">
									<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
										/>
									</svg>
								</div>
								<h3 className="font-semibold text-foreground mb-2">Plan Your Meals</h3>
								<p className="text-secondary text-sm">Organize your weekly meal plans and never wonder &ldquo;what&quot;s for dinner?&rdquo; again.</p>
							</div>

							<div className="bg-surface border border-custom rounded-lg p-6">
								<div className="text-accent mb-3">
									<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
										/>
									</svg>
								</div>
								<h3 className="font-semibold text-foreground mb-2">Track Your Stats</h3>
								<p className="text-secondary text-sm">See your meal planning history and discover patterns in your favorite recipes.</p>
							</div>

							<div className="bg-surface border border-custom rounded-lg p-6">
								<div className="text-accent mb-3">
									<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6m0 0h16M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z"
										/>
									</svg>
								</div>
								<h3 className="font-semibold text-foreground mb-2">Generate Shopping Lists</h3>
								<p className="text-secondary text-sm">Automatically create shopping lists from your planned meals to save time.</p>
							</div>
						</div>

						{error && (
							<div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
								<p className="text-red-600 text-sm">Error: {error}</p>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	// Authenticated - show the existing meal plans interface
	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<HeaderPage title={`Welcome back, ${user?.username || 'User'}!`} subtitle="Last 6 months of meal planning." />
				</div>

				{plans.length === 0 && (
					<div className="bg-surface border border-custom rounded-lg p-8 text-center">
						<p className="text-secondary">{error ? `Error: ${error}` : 'No menus found. Start planning your first meal!'}</p>
						{!error && (
							<Link
								href="/plans/new"
								className="mt-4 bg-accent text-background px-4 py-2 rounded-md text-sm font-medium hover:bg-accent/90 transition-colors inline-block"
							>
								Create Your First Plan
							</Link>
						)}
					</div>
				)}

				{stats && (
					<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
						<div className="bg-surface border border-custom rounded-lg p-4 text-center">
							<p className="text-2xl font-semibold text-foreground">{stats.totalWeeks}</p>
							<p className="text-xs text-muted">Weeks</p>
						</div>
						<div className="bg-surface border border-custom rounded-lg p-4 text-center">
							<p className="text-2xl font-semibold text-foreground">{stats.totalRecipes}</p>
							<p className="text-xs text-muted">Meals</p>
						</div>
						<div className="bg-surface border border-custom rounded-lg p-4 text-center">
							<p className="text-2xl font-semibold text-foreground">{stats.avgRecipesPerWeek}</p>
							<p className="text-xs text-muted">Avg per Week</p>
						</div>
					</div>
				)}

				{plans.length > 0 && (
					<div className="flex flex-wrap gap-6 items-start">
						{plans.map(({ year, week, meals }) => (
							<MenuCard key={`${year}-${week}`} year={year} week={week} meals={meals} />
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function Meal({ meal, isLast }: { meal: Meal; isLast: boolean }) {
	return (
		<div className={`${!isLast ? 'border-b border-light' : ''}`}>
			<p className="font-sm text-foreground text-sm leading-snug flex items-center gap-3 pr-3">
				<span className="w-12 h-12 bg-gray-200 overflow-hidden flex-shrink-0">
					<Image src={`/static/${meal.filename}.jpg`} alt="thumb" width="48" height="48" className="w-full h-full object-cover" unoptimized={true} />
				</span>
				{meal.name}
			</p>
		</div>
	);
}

function MenuCard({ year, week, meals }: Menu) {
	return (
		<div className="flex-1 min-w-80 max-w-sm bg-surface border border-custom rounded-lg overflow-hidden hover:shadow-md transition-shadow">
			<div className="bg-accent text-background px-4 py-3 flex items-center justify-between">
				<h2 className="text-base font-medium">
					Week {week}, {year}
				</h2>
				<a
					href={`/shop?week=${week}&year=${year}`}
					className="opacity-90 hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
					title="Shopping list"
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5-6m0 0h16M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z"
						/>
					</svg>
				</a>
			</div>

			<div className="">
				<div className="">
					{meals.map(meal => (
						<Meal key={meal.id} meal={meal} isLast={meals[meals.length - 1].id === meal.id} />
					))}
				</div>
			</div>
		</div>
	);
}
