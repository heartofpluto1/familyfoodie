import HeaderPage from '@/app/components/HeaderPage';
import Image from 'next/image';
import Link from 'next/link';
import type { Stats, Meal, Menu } from '@/types/menus';
import { IntroShoppingCartIcon } from '@/app/components/Icons';
import { formatWeekDateRange } from '@/lib/utils/weekDates';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';
import { generateRecipeUrl } from '@/lib/utils/urlHelpers';
import NewUserWelcome from './components/NewUserWelcome';

interface HomeAuthenticatedProps {
	plans: Menu[];
	stats: Stats;
	householdName: string;
}

export default function HomeAuthenticated({ plans, stats, householdName }: HomeAuthenticatedProps) {
	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				{plans.length < 2 ? (
					<>
						<NewUserWelcome householdName={householdName} />
						{plans.length > 0 && (
							<div className="mt-8 space-y-4">
								<h3 className="text-xl text-foreground text-center">Your Planned Weeks</h3>
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
									{plans.map(({ year, week, meals }) => (
										<MenuCard key={`${year}-${week}`} year={year} week={week} meals={meals} />
									))}
								</div>
							</div>
						)}
					</>
				) : (
					<>
						<div className="mb-8">
							<HeaderPage title={`Welcome to the ${householdName} household`} subtitle="Last 6 months of meal planning." />
						</div>
					</>
				)}

				{plans.length >= 2 && stats && (
					<div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
						<div className="bg-surface border border-custom rounded-sm p-2 sm:p-4 text-center">
							<p className="text-lg sm:text-2xl font-semibold text-foreground">{stats.totalWeeks}</p>
							<p className="text-xs text-muted">Weeks</p>
						</div>
						<div className="bg-surface border border-custom rounded-sm p-2 sm:p-4 text-center">
							<p className="text-lg sm:text-2xl font-semibold text-foreground">{stats.totalRecipes}</p>
							<p className="text-xs text-muted">Meals</p>
						</div>
						<div className="bg-surface border border-custom rounded-sm p-2 sm:p-4 text-center">
							<p className="text-lg sm:text-2xl font-semibold text-foreground">{stats.avgRecipesPerWeek}</p>
							<p className="text-xs text-muted">Avg per Week</p>
						</div>
					</div>
				)}

				{plans.length >= 2 && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
						{plans.map(({ year, week, meals }) => (
							<MenuCard key={`${year}-${week}`} year={year} week={week} meals={meals} />
						))}
					</div>
				)}

				{/* Bottom navigation links */}
				<div className="flex justify-center gap-8 py-8">
					<Link
						href="/ingredients"
						className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline text-sm"
					>
						Ingredients
					</Link>
					<Link href="/insights" className="text-secondary hover:text-foreground transition-colors font-medium underline-offset-4 hover:underline text-sm">
						Insights
					</Link>
				</div>
			</div>
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
					{meals.map((meal, index) => (
						<Meal key={`${meal.id}-${index}`} meal={meal} isLast={index === meals.length - 1} />
					))}
				</div>
			</div>
		</div>
	);
}
