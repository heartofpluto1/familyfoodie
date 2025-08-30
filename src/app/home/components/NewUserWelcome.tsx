import Link from 'next/link';
import { IntroPlanIcon, IntroShoppingCartIcon, SparklesIcon } from '@/app/components/Icons';

interface NewUserWelcomeProps {
	householdName: string;
}

export default function NewUserWelcome({ householdName }: NewUserWelcomeProps) {
	return (
		<div className="space-y-8">
			{/* Hero Section */}
			<div className="bg-surface border border-custom rounded-sm p-8 text-center">
				<div className="mb-6">
					<h2 className="text-2xl text-foreground mb-2">Welcome to the {householdName} kitchen! 🍽️</h2>
				</div>

				<div className="max-w-2xl mx-auto">
					<p className="text-secondary mb-6">
						Family Foodie helps you plan meals in advance, generate automatic shopping lists, and track your favorite recipes. Join families who save 3+
						hours per week with smart meal planning.
					</p>
				</div>
			</div>

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
		</div>
	);
}
