import HeaderPage from '@/app/components/HeaderPage';
import Image from 'next/image';
import Link from 'next/link';
import type { Stats, Meal, Menu } from '@/types/menus';
import { IntroShoppingCartIcon } from '@/app/components/Icons';
import { formatWeekDateRange } from '@/lib/utils/weekDates';

interface HomeAuthenticatedProps {
	plans: Menu[];
	stats: Stats;
}

export default function HomeAuthenticated({ plans, stats }: HomeAuthenticatedProps) {
	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<HeaderPage title="Welcome back!" subtitle="Last 6 months of meal planning." />
				</div>

				{plans.length === 0 && (
					<div className="bg-surface border border-custom rounded-sm p-8 text-center">
						<p className="text-secondary">No menus found. Start planning your first meal!</p>
						<Link
							href="/plan"
							className="mt-4 bg-accent text-background px-4 py-2 rounded-md text-sm font-medium hover:bg-accent/90 transition-colors inline-block"
						>
							Create Your First Plan
						</Link>
					</div>
				)}

				{stats && (
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

				{plans.length > 0 && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
	const weekDateRange = formatWeekDateRange(week, year);

	return (
		<div className="bg-surface border border-custom rounded-sm overflow-hidden hover:shadow-md transition-shadow">
			<div className="bg-accent text-background px-4 py-3">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-base font-medium">
							Week {week}, {year}
						</h2>
						<p className="text-xs text-muted mt-0.5">{weekDateRange}</p>
					</div>
					<a
						href={`/shop?week=${week}&year=${year}`}
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
