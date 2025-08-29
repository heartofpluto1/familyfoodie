import Link from 'next/link';
import { IntroPlanIcon, IntroShoppingCartIcon, SparklesIcon } from '@/app/components/Icons';
import type { Menu, Meal } from '@/types/menus';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';
import { formatWeekDateRange } from '@/lib/utils/weekDates';
import { generateRecipeUrl } from '@/lib/utils/urlHelpers';
import Image from 'next/image';

interface NewUserWelcomeProps {
	householdName: string;
	plans?: Menu[];
}

export default function NewUserWelcome({ householdName, plans = [] }: NewUserWelcomeProps) {
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

			{/* Planned Weeks - show if user has any plans */}
			{plans.length > 0 && (
				<div className="space-y-4">
					<h3 className="text-xl text-foreground text-center">Your Planned Weeks</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{plans.map(({ year, week, meals }) => (
							<MenuCard key={`${year}-${week}`} year={year} week={week} meals={meals} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function Meal({ meal, isLast }: { meal: Meal; isLast: boolean }) {
	return (
		<div className={`${!isLast ? 'border-b border-light' : ''}`}>
			<p className="font-sm text-foreground text-sm leading-snug flex items-center gap-3 pr-3">
				<span className="w-12 h-12 bg-gray-200 overflow-hidden flex-shrink-0">
					<Image
						src={getRecipeImageUrl(meal.image_filename)}
						alt="thumb"
						width="48"
						height="48"
						className="w-full h-full object-cover"
						unoptimized={true}
					/>
				</span>
				<Link
					href={generateRecipeUrl({
						url_slug: meal.url_slug,
						collection_url_slug: meal.collection_url_slug,
					} as Parameters<typeof generateRecipeUrl>[0])}
					className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors hover:underline"
				>
					{meal.name}
				</Link>
			</p>
		</div>
	);
}

function MenuCard({ year, week, meals }: Menu) {
	const weekDateRange = formatWeekDateRange(week, year);

	return (
		<div className="bg-surface border border-custom rounded-sm overflow-hidden hover:shadow-md transition-shadow">
			<div className="bg-accent text-background px-3 py-3">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg">Week {week}</h3>
						<p className="text-xs text-muted mt-0.5">{weekDateRange}</p>
					</div>
					<a
						href={`/shop/${year}/${week}`}
						className="opacity-90 hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
						title="Shopping list"
					>
						<IntroShoppingCartIcon className="w-5 h-5" />
					</a>
				</div>
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
