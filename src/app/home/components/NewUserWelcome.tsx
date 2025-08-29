import Link from 'next/link';
import { IntroPlanIcon, IntroShoppingCartIcon, SparklesIcon, TimeIcon } from '@/app/components/Icons';
import type { Recipe } from '@/types/menus';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';

interface NewUserWelcomeProps {
	householdName: string;
	sampleRecipes?: Recipe[];
}

export default function NewUserWelcome({ householdName, sampleRecipes = [] }: NewUserWelcomeProps) {
	return (
		<div className="space-y-8">
			{/* Hero Section */}
			<div className="bg-surface border border-custom rounded-sm p-8 text-center">
				<div className="mb-6">
					<h2 className="text-2xl text-foreground mb-2">Welcome to the {householdName} kitchen! 🍽️</h2>
					<p className="text-lg text-secondary mb-4">&ldquo;Never ask &lsquo;what&rsquo;s for dinner?&rsquo; again&rdquo;</p>
				</div>

				<div className="max-w-2xl mx-auto">
					<p className="text-secondary mb-6">
						Family Foodie helps you plan meals in advance, generate automatic shopping lists, and track your favorite recipes. Join families who save 3+
						hours per week with smart meal planning.
					</p>
				</div>
			</div>

			{/* Sample Recipe Preview */}
			{sampleRecipes.length > 0 && (
				<div className="bg-surface border border-custom rounded-sm p-6">
					<h3 className="text-xl text-foreground mb-4 text-center">Here&rsquo;s what your first week could look like:</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
						{sampleRecipes.slice(0, 4).map(recipe => (
							<div key={recipe.id} className="bg-background border border-custom rounded-sm overflow-hidden hover:shadow-md transition-shadow">
								<img
									src={getRecipeImageUrl(recipe.image_filename)}
									alt={recipe.name}
									className="w-full h-32 object-cover"
									onError={e => {
										e.currentTarget.src = '/onerror_recipe.png';
									}}
								/>
								<div className="p-3">
									<h4 className="text-sm font-medium text-foreground mb-1">{recipe.name}</h4>
									{recipe.prepTime && recipe.cookTime && (
										<p className="text-xs text-muted flex items-center">
											<TimeIcon className="w-3 h-3 mr-1" />
											{recipe.prepTime + recipe.cookTime} min
										</p>
									)}
									{recipe.cost && (
										<div className="inline-block bg-accent text-background text-xs px-2 py-1 rounded-full mt-2">£{recipe.cost.toFixed(2)}</div>
									)}
								</div>
							</div>
						))}
					</div>
					<p className="text-center text-sm text-secondary">These could be your planned meals with automatic shopping lists generated!</p>
				</div>
			)}

			{/* Progressive Entry Points */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* Browse Recipes */}
				<div className="bg-surface border border-custom rounded-sm p-6 text-center hover:shadow-md transition-shadow">
					<div className="text-accent mb-4 flex justify-center">
						<SparklesIcon className="w-8 h-8" />
					</div>
					<h3 className="text-foreground mb-2 font-medium">Browse ~200 Recipes</h3>
					<p className="text-secondary text-sm mb-4">We&rsquo;ve already loaded your kitchen with hundreds of delicious recipes to explore.</p>
					<Link
						href="/recipes"
						className="bg-accent text-background px-4 py-2 rounded-sm text-sm font-medium hover:bg-accent/90 transition-colors inline-block"
					>
						Browse Recipes
					</Link>
				</div>

				{/* This Weekend */}
				<div className="bg-surface border border-custom rounded-sm p-6 text-center hover:shadow-md transition-shadow">
					<div className="text-accent mb-4 flex justify-center">
						<IntroPlanIcon className="w-8 h-8" />
					</div>
					<h3 className="text-foreground mb-2 font-medium">Plan This Weekend</h3>
					<p className="text-secondary text-sm mb-4">Plan 2-3 meals for the weekend. Great for trying new recipes!</p>
					<Link
						href="/plan"
						className="bg-accent text-background px-4 py-2 rounded-sm text-sm font-medium hover:bg-accent/90 transition-colors inline-block"
					>
						Plan Weekend
					</Link>
				</div>

				{/* Full Week */}
				<div className="bg-surface border border-custom rounded-sm p-6 text-center hover:shadow-md transition-shadow">
					<div className="text-accent mb-4 flex justify-center">
						<IntroShoppingCartIcon className="w-8 h-8" />
					</div>
					<h3 className="text-foreground mb-2 font-medium">Plan Your Full Week</h3>
					<p className="text-secondary text-sm mb-4">Ready to go all in? Plan 7 meals and generate a complete shopping list.</p>
					<Link
						href="/plan"
						className="bg-accent text-background px-4 py-2 rounded-sm text-sm font-medium hover:bg-accent/90 transition-colors inline-block"
					>
						Plan Full Week
					</Link>
				</div>
			</div>

			{/* Value Demonstration */}
			<div className="bg-surface border border-custom rounded-sm p-6">
				<h3 className="text-xl text-foreground mb-4 text-center">See what happens when you plan ahead:</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="text-center">
						<h4 className="text-foreground mb-2 font-medium">Before Planning</h4>
						<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm p-4">
							<p className="text-sm text-secondary">
								😰 &ldquo;What&rsquo;s for dinner?&rdquo; panic at 5pm
								<br />
								🛒 Multiple grocery store trips
								<br />
								💸 Expensive last-minute takeout
								<br />
								🗑️ Food waste from impulse buys
							</p>
						</div>
					</div>
					<div className="text-center">
						<h4 className="text-foreground mb-2 font-medium">After Planning</h4>
						<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-sm p-4">
							<p className="text-sm text-secondary">
								😌 Confident knowing what&rsquo;s planned
								<br />
								📋 One efficient shopping trip
								<br />
								💰 Budget-friendly home cooking
								<br />
								♻️ Zero waste with precise ingredients
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Motivation Footer */}
			<div className="text-center">
				<p className="text-sm text-muted">
					<strong>You&rsquo;re just one recipe away from getting started!</strong>
					<br />
					Join hundreds of families who never stress about dinner again.
				</p>
			</div>
		</div>
	);
}
