'use client';

import { IntroPlanIcon, IntroStatsIcon, IntroShoppingCartIcon } from '@/app/components/Icons';
import PopularRecipeCard from '@/app/components/PopularRecipeCard';
import { PopularRecipe } from '@/lib/queries/popular';
import Link from 'next/link';
import { ArrowRightIcon, SparklesIcon, UsersIcon } from '@heroicons/react/24/outline';

interface HomeUnauthenticatedProps {
	popularRecipes: PopularRecipe[];
	activeHouseholds: number;
}

export default function HomeUnauthenticated({ popularRecipes, activeHouseholds }: HomeUnauthenticatedProps) {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<div 
				className="relative border-b border-custom"
				style={{
					backgroundImage: `url('https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?q=80&w=2940')`,
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					backgroundRepeat: 'no-repeat'
				}}
			>
				{/* Gradient overlay for text readability */}
				<div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/60 to-white/70 dark:from-black/70 dark:via-black/60 dark:to-black/70"></div>
				
				{/* Content */}
				<div className="relative z-10 container mx-auto px-4 py-12">
					<div className="max-w-4xl mx-auto text-center">
						<div className="flex justify-center mb-4">
							<SparklesIcon className="w-12 h-12 text-black dark:text-white" />
						</div>
						<h1 className="text-4xl md:text-5xl text-foreground mb-4">See What Families Are Cooking This Week</h1>
						<p className="text-xl text-secondary mb-8">
							Join our families planning delicious, stress-free meals
						</p>

						<Link
							href="/auth/signin"
							className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-sm text-lg transition-colors"
						>
							Start Planning Your Meals
							<ArrowRightIcon className="w-5 h-5" />
						</Link>

						<div className="flex items-center justify-center gap-2 mt-4 text-sm text-secondary">
							<UsersIcon className="w-4 h-4" />
							<span>Free to use • No credit card required</span>
						</div>
					</div>
				</div>
			</div>

			{/* Popular Recipes Section */}
			{popularRecipes.length > 0 && (
				<div className="container mx-auto px-4 py-12">
					<div className="max-w-6xl mx-auto">
						<div className="text-center mb-8">
							<h2 className="text-3xl text-foreground mb-2">This Month&apos;s Most Popular Dinners</h2>
							<p className="text-secondary">Real recipes from real families • Updated daily</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
							{popularRecipes.map(recipe => (
								<Link key={recipe.id} href="/auth/signin">
									<PopularRecipeCard
										name={recipe.name}
										imageFilename={recipe.image_filename}
										cookTime={recipe.cookTime}
										prepTime={recipe.prepTime}
										planCount={recipe.plan_count}
									/>
								</Link>
							))}
						</div>

						<div className="text-center">
							<Link href="/auth/signin" className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-semibold underline transition-colors">
								View All Recipes
								<ArrowRightIcon className="w-4 h-4" />
							</Link>
						</div>
					</div>
				</div>
			)}

			{/* Features Section */}
			<div className="bg-surface border-y border-custom">
				<div className="container mx-auto px-4 py-12">
					<div className="max-w-4xl mx-auto">
						<h2 className="text-2xl text-center text-foreground mb-8">Everything You Need for Meal Planning Success</h2>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="text-center">
								<div className="text-black dark:text-white mb-3 flex justify-center">
									<IntroPlanIcon />
								</div>
								<h3 className="text-foreground font-semibold mb-2">Weekly Meal Plans</h3>
								<p className="text-secondary text-sm">Drag and drop recipes into your week. Planning made simple.</p>
							</div>

							<div className="text-center">
								<div className="text-black dark:text-white mb-3 flex justify-center">
									<IntroShoppingCartIcon />
								</div>
								<h3 className="text-foreground font-semibold mb-2">Smart Shopping Lists</h3>
								<p className="text-secondary text-sm">Auto-generate shopping lists from your meal plans. Never forget an ingredient.</p>
							</div>

							<div className="text-center">
								<div className="text-black dark:text-white mb-3 flex justify-center">
									<IntroStatsIcon />
								</div>
								<h3 className="text-foreground font-semibold mb-2">Meal History & Stats</h3>
								<p className="text-secondary text-sm">Track what you&apos;ve cooked and discover your family favorites.</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Final CTA */}
			<div className="container mx-auto px-4 py-12">
				<div className="max-w-2xl mx-auto text-center">
					<div className="bg-surface border border-custom rounded-sm p-8">
						<h2 className="text-2xl text-foreground mb-4">Ready to Simplify Dinner Time?</h2>
						<p className="text-secondary mb-6">
							Join our community of meal planners and make &ldquo;what&apos;s for dinner?&rdquo; the easiest question of your day.
						</p>
						<Link
							href="/auth/signin"
							className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-sm transition-colors"
						>
							Get Started Free
							<ArrowRightIcon className="w-4 h-4" />
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
