'use client';

import { IntroPlanIcon, IntroCookIcon, IntroShoppingCartIcon } from '@/app/components/Icons';
import PopularRecipeCard from '@/app/components/PopularRecipeCard';
import { PopularRecipe } from '@/lib/queries/popular';
import Link from 'next/link';
import { ArrowRightIcon, SparklesIcon, UsersIcon } from '@heroicons/react/24/outline';

interface HomeUnauthenticatedProps {
	popularRecipes: PopularRecipe[];
	activeHouseholds: number;
}

export default function HomeUnauthenticated({ popularRecipes }: HomeUnauthenticatedProps) {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<div
				className="relative border-b border-custom"
				style={{
					backgroundImage: "url('/hero5.jpg')",
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					backgroundRepeat: 'no-repeat',
				}}
			>
				{/* Gradient overlay for text readability */}
				<div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/80 to-white/85 dark:from-black/85 dark:via-black/80 dark:to-black/85"></div>

				{/* Content */}
				<div className="relative z-10 container mx-auto px-4 py-12">
					<div className="max-w-4xl mx-auto text-center">
						<div className="flex justify-center mb-4">
							<SparklesIcon className="w-12 h-12 text-black dark:text-white" />
						</div>
						<h1 className="text-4xl md:text-5xl text-foreground mb-4">Meal Planning That Actually Works</h1>
						<p className="text-xl text-secondary mb-8">Plan your week in 2 minutes, shop once, cook happy</p>

						<Link
							href="/auth/signin"
							className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-sm text-lg transition-colors"
						>
							Start Planning
							<ArrowRightIcon className="w-5 h-5" />
						</Link>

						<div className="flex items-center justify-center gap-2 mt-4 text-sm text-secondary">
							<UsersIcon className="w-4 h-4" />
							<span>Free to use • No credit card required</span>
						</div>
					</div>
				</div>
			</div>

			{/* Pain Points Section */}
			<div className="bg-white dark:bg-gray-900 border-b border-custom">
				<div className="container mx-auto px-4 py-12">
					<div className="max-w-4xl mx-auto">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-2">That 5pm panic?</h3>
								<p className="text-secondary text-sm">Know what&apos;s for dinner all week long</p>
							</div>
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-2">Three trips for one recipe?</h3>
								<p className="text-secondary text-sm">One list. One trip. Done.</p>
							</div>
							<div>
								<h3 className="text-lg font-semibold text-foreground mb-2">Chicken again?</h3>
								<p className="text-secondary text-sm">Mix it up with fresh ideas every week</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Popular Recipes Section */}
			{popularRecipes.length > 0 && (
				<div className="container mx-auto px-4 py-12">
					<div className="max-w-6xl mx-auto">
						<div className="text-center mb-8">
							<h2 className="text-3xl text-foreground mb-2">What&apos;s Cooking This Week</h2>
							<p className="text-secondary">Fresh ideas from real kitchens</p>
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
							<Link
								href="/auth/signin"
								className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-semibold underline transition-colors"
							>
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
						<h2 className="text-2xl text-center text-foreground mb-8">How It Works</h2>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="text-center">
								<div className="text-black dark:text-white mb-3 flex justify-center">
									<IntroPlanIcon />
								</div>
								<h3 className="text-foreground font-semibold mb-2">1. Pick Your Meals</h3>
								<p className="text-secondary text-sm">Click, click, done. Planning a whole week takes 2 minutes.</p>
							</div>

							<div className="text-center">
								<div className="text-black dark:text-white mb-3 flex justify-center">
									<IntroShoppingCartIcon />
								</div>
								<h3 className="text-foreground font-semibold mb-2">2. Get Your List</h3>
								<p className="text-secondary text-sm">Sorted by aisle. Check off as you go. Magic!</p>
							</div>

							<div className="text-center">
								<div className="text-black dark:text-white mb-3 flex justify-center">
									<IntroCookIcon />
								</div>
								<h3 className="text-foreground font-semibold mb-2">3. Cook & Enjoy</h3>
								<p className="text-secondary text-sm">No more dinner stress. Just good food with your people.</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Final CTA */}
			<div className="container mx-auto px-4 py-12">
				<div className="max-w-2xl mx-auto text-center">
					<div className="bg-surface border border-custom rounded-sm p-8">
						<h2 className="text-2xl text-foreground mb-4">Dinner sorted, life simplified.</h2>
						<p className="text-secondary mb-6">We can&apos;t help with all the mental load of life, but at least we can help with this.</p>
						<Link
							href="/auth/signin"
							className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-sm transition-colors"
						>
							Take meal planning off my plate
							<ArrowRightIcon className="w-4 h-4" />
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
