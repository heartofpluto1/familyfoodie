import {
	getAverageWeeklySpending,
	getTopFruitsAndVegetables,
	getTopHerbs,
	getTopRecipes,
	getGardenSavings,
	getRecipePairingSuggestions,
	getPlannedWeeksCount,
} from '@/lib/queries/insights';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import HeaderPage from '@/app/components/HeaderPage';
import { formatPrice } from '@/lib/utils/formatting';
import Link from 'next/link';
import Image from 'next/image';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';
import { generateRecipeUrl } from '@/lib/utils/urlHelpers';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export default async function InsightsPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}
	const householdId = session.user.household_id;

	// Check if household has enough planning data
	const plannedWeeksCount = await getPlannedWeeksCount(householdId);

	// Show placeholder if insufficient data
	if (plannedWeeksCount <= 2) {
		return (
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					<HeaderPage title="Food Insights" subtitle="Discover patterns in your eating habits and spending to make smarter food choices." />

					<main className="container mx-auto py-4">
						<div className="bg-white border border-custom rounded-sm shadow-md p-12 text-center">
							<div className="max-w-md mx-auto space-y-4">
								<h2 className="text-2xl font-semibold text-foreground">Start Planning Your Meals</h2>
								<p className="text-gray-600 dark:text-gray-400">
									Food insights become available after you&apos;ve planned a few weeks of meals. Start planning your weekly meals and come back in a
									couple of weeks to see personalized insights about your eating habits, spending patterns, and recipe recommendations.
								</p>
								<Link
									href="/plan"
									className="inline-block bg-accent text-background px-6 py-3 rounded-sm font-medium hover:bg-accent/90 transition-colors mt-4"
								>
									Start Planning
								</Link>
							</div>
						</div>
					</main>
				</div>
			</div>
		);
	}

	const [weeklySpending, topFruitsAndVeggies, topHerbs, topRecipes, recipePairings] = await Promise.all([
		getAverageWeeklySpending(householdId),
		getTopFruitsAndVegetables(householdId),
		getTopHerbs(householdId),
		getTopRecipes(householdId),
		getRecipePairingSuggestions(householdId),
	]);

	// Get garden savings for top 3 fruits & vegetables and herbs
	const gardenSavings = await getGardenSavings(topFruitsAndVeggies, householdId);
	const herbGardenSavings = await getGardenSavings(topHerbs, householdId);

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				<HeaderPage title="Food Insights" subtitle="Discover patterns in your eating habits and spending to make smarter food choices." />

				<main className="container mx-auto py-4 space-y-6">
					{/* Spending Overview */}
					<div className="bg-white border border-custom rounded-sm shadow-md p-6">
						<h2 className="text-xl font-semibold mb-4 text-foreground">Weekly Spending Overview</h2>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
								<p className="text-sm text-gray-600 dark:text-gray-400">Average per week</p>
								<p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatPrice(weeklySpending.average)}</p>
							</div>
							<div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
								<p className="text-sm text-gray-600 dark:text-gray-400">Total spent (last year)</p>
								<p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatPrice(weeklySpending.total)}</p>
							</div>
							<div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
								<p className="text-sm text-gray-600 dark:text-gray-400">Weeks tracked</p>
								<p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{weeklySpending.weeks}</p>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Top Fruits & Vegetables */}
						<div className="bg-white border border-custom rounded-sm shadow-md p-6">
							<h2 className="text-xl font-semibold mb-4 text-foreground">Top Vegetables</h2>
							<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Most frequently purchased vegetables (last 12 months)</p>
							<div className="space-y-3">
								{topFruitsAndVeggies.map((item, index) => (
									<div key={item.name} className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<span className="flex items-center justify-center w-6 h-6 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
												{index + 1}
											</span>
											<Link
												href={`/recipe?search=${encodeURIComponent(item.name)}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm font-medium capitalize text-secondary hover:text-foreground underline transition-colors"
											>
												{item.name}
											</Link>
										</div>
										<span className="text-xs text-gray-500 dark:text-gray-400">
											{item.frequency} {item.frequency === 1 ? 'week' : 'weeks'}
										</span>
									</div>
								))}
								{topFruitsAndVeggies.length === 0 && (
									<p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No vegetables data available</p>
								)}
							</div>
						</div>

						{/* Garden Savings Analysis */}
						{gardenSavings.length > 0 && (
							<div className="bg-white border border-custom rounded-sm shadow-md p-6">
								<h2 className="text-xl font-semibold mb-4 text-foreground">Veg Garden Potential</h2>
								<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
									Potential savings if you grew your top 5 vegetables during Spring months (Sep-Nov)
								</p>
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-gray-200 dark:border-gray-700">
												<th className="px-2 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Item</th>
												<th className="px-2 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">Weeks</th>
												<th className="px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Spring Cost</th>
												<th className="px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Annual Savings*</th>
											</tr>
										</thead>
										<tbody>
											{gardenSavings.map(item => {
												// Estimate annual savings by multiplying spring cost by ~3
												// (Spring + Summer harvest could cover most of the year)
												const annualSavings = item.total_cost * 3;
												return (
													<tr key={item.name} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
														<td className="px-2 py-2 text-xs font-medium capitalize">{item.name}</td>
														<td className="px-2 py-2 text-xs text-center">{item.frequency}</td>
														<td className="px-2 py-2 text-xs text-right font-medium">{formatPrice(item.total_cost)}</td>
														<td className="px-2 py-2 text-xs text-right font-bold text-green-600 dark:text-green-400">
															{formatPrice(annualSavings)}
														</td>
													</tr>
												);
											})}
											<tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
												<td className="px-2 py-2 text-xs font-bold">Total</td>
												<td className="px-2 py-2 text-xs text-center font-medium">
													{gardenSavings.reduce((sum, item) => sum + item.frequency, 0)}
												</td>
												<td className="px-2 py-2 text-xs text-right font-bold">
													{formatPrice(gardenSavings.reduce((sum, item) => sum + item.total_cost, 0))}
												</td>
												<td className="px-2 py-2 text-xs text-right font-bold text-green-600 dark:text-green-400">
													{formatPrice(gardenSavings.reduce((sum, item) => sum + item.total_cost * 3, 0))}
												</td>
											</tr>
										</tbody>
									</table>
								</div>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
									* Estimated annual savings assume a spring/summer garden could provide these items for ~9 months of the year.
								</p>
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Top Herbs */}
						<div className="bg-white border border-custom rounded-sm shadow-md p-6">
							<h2 className="text-xl font-semibold mb-4 text-foreground">Top Herbs</h2>
							<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Most frequently purchased herbs (last 12 months)</p>
							<div className="space-y-3">
								{topHerbs.map((item, index) => (
									<div key={item.name} className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<span className="flex items-center justify-center w-6 h-6 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
												{index + 1}
											</span>
											<Link
												href={`/recipe?search=${encodeURIComponent(item.name)}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm font-medium capitalize text-secondary hover:text-foreground underline transition-colors"
											>
												{item.name}
											</Link>
										</div>
										<span className="text-xs text-gray-500 dark:text-gray-400">
											{item.frequency} {item.frequency === 1 ? 'week' : 'weeks'}
										</span>
									</div>
								))}
								{topHerbs.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No herbs data available</p>}
							</div>
						</div>

						{/* Herb Garden Savings Analysis */}
						{herbGardenSavings.length > 0 && (
							<div className="bg-white border border-custom rounded-sm shadow-md p-6">
								<h2 className="text-xl font-semibold mb-4 text-foreground">Herb Garden Potential</h2>
								<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
									Potential savings if you grew your top 5 herbs during Spring months (Sep-Nov)
								</p>
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-gray-200 dark:border-gray-700">
												<th className="px-2 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Herb</th>
												<th className="px-2 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">Weeks</th>
												<th className="px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Spring Cost</th>
												<th className="px-2 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">Annual Savings*</th>
											</tr>
										</thead>
										<tbody>
											{herbGardenSavings.map(item => {
												// Estimate annual savings by multiplying spring cost by ~4
												// (Herbs can be harvested year-round in many climates)
												const annualSavings = item.total_cost * 4;
												return (
													<tr key={item.name} className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
														<td className="px-2 py-2 text-xs font-medium capitalize">{item.name}</td>
														<td className="px-2 py-2 text-xs text-center">{item.frequency}</td>
														<td className="px-2 py-2 text-xs text-right font-medium">{formatPrice(item.total_cost)}</td>
														<td className="px-2 py-2 text-xs text-right font-bold text-green-600 dark:text-green-400">
															{formatPrice(annualSavings)}
														</td>
													</tr>
												);
											})}
											<tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
												<td className="px-2 py-2 text-xs font-bold">Total</td>
												<td className="px-2 py-2 text-xs text-center font-medium">
													{herbGardenSavings.reduce((sum, item) => sum + item.frequency, 0)}
												</td>
												<td className="px-2 py-2 text-xs text-right font-bold">
													{formatPrice(herbGardenSavings.reduce((sum, item) => sum + item.total_cost, 0))}
												</td>
												<td className="px-2 py-2 text-xs text-right font-bold text-green-600 dark:text-green-400">
													{formatPrice(herbGardenSavings.reduce((sum, item) => sum + item.total_cost * 4, 0))}
												</td>
											</tr>
										</tbody>
									</table>
								</div>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
									* Estimated annual savings assume herbs can be grown and harvested for ~12 months of the year.
								</p>
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
						{/* Top Recipes */}
						<div className="bg-white border border-custom rounded-sm shadow-md p-6">
							<h2 className="text-xl font-semibold mb-4 text-foreground">Most Planned Recipes</h2>
							<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Your go-to recipes from meal planning (last 12 months)</p>
							<div className="space-y-3">
								{topRecipes.map((recipe, index) => (
									<div key={recipe.id} className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<span className="flex items-center justify-center w-6 h-6 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full">
												{index + 1}
											</span>
											<Link
												href={generateRecipeUrl(recipe)}
												target="_blank"
												rel="noopener noreferrer"
												className="text-sm font-medium text-secondary hover:text-foreground underline transition-colors"
											>
												{recipe.name}
											</Link>
										</div>
										<span className="text-xs text-gray-500 dark:text-gray-400">
											{recipe.times_planned} {recipe.times_planned === 1 ? 'week' : 'weeks'}
										</span>
									</div>
								))}
								{topRecipes.length === 0 && (
									<p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No recipe planning data available</p>
								)}
							</div>
						</div>
					</div>

					{/* Recipe Pairing Suggestions */}
					{recipePairings.length > 0 && (
						<div className="grid grid-cols-1 gap-6">
							<div className="bg-white border border-custom rounded-sm shadow-md p-6">
								<h2 className="text-xl font-semibold mb-4 text-foreground">Recipe Pairing Suggestions</h2>
								<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Smart pairings based on shared fresh ingredients to minimize waste</p>
								<div className="space-y-6">
									{recipePairings.map((pairing, index) => (
										<div
											key={`${pairing.recipe1_id}-${pairing.recipe2_id}`}
											className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20"
										>
											<div className="flex items-center gap-3 mb-3">
												<span className="flex items-center justify-center w-6 h-6 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex-shrink-0">
													{index + 1}
												</span>
												<span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
													Shared: {pairing.shared_ingredient}
												</span>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
												{/* Recipe 1 */}
												<div className="flex items-center gap-3">
													<div className="w-12 h-12 bg-gray-200 overflow-hidden rounded flex-shrink-0">
														<Image
															src={getRecipeImageUrl(pairing.recipe1_image_filename)}
															alt={pairing.recipe1_name}
															width={48}
															height={48}
															className="w-full h-full object-cover"
															unoptimized={true}
														/>
													</div>
													<div className="flex-1 min-w-0">
														<Link
															href={generateRecipeUrl({
																url_slug: pairing.recipe1_url_slug,
																collection_url_slug: pairing.recipe1_collection_url_slug,
															})}
															target="_blank"
															rel="noopener noreferrer"
															className="text-sm font-medium text-secondary hover:text-foreground underline transition-colors block truncate"
														>
															{pairing.recipe1_name}
														</Link>
													</div>
												</div>

												{/* Recipe 2 */}
												<div className="flex items-center gap-3">
													<div className="w-12 h-12 bg-gray-200 overflow-hidden rounded flex-shrink-0">
														<Image
															src={getRecipeImageUrl(pairing.recipe2_image_filename)}
															alt={pairing.recipe2_name}
															width={48}
															height={48}
															className="w-full h-full object-cover"
															unoptimized={true}
														/>
													</div>
													<div className="flex-1 min-w-0">
														<Link
															href={generateRecipeUrl({
																url_slug: pairing.recipe2_url_slug,
																collection_url_slug: pairing.recipe2_collection_url_slug,
															})}
															target="_blank"
															rel="noopener noreferrer"
															className="text-sm font-medium text-secondary hover:text-foreground underline transition-colors block truncate"
														>
															{pairing.recipe2_name}
														</Link>
													</div>
												</div>
											</div>

											<p className="text-xs text-gray-600 dark:text-gray-400 pl-9">{pairing.explanation}</p>
										</div>
									))}
								</div>
								{recipePairings.length === 0 && (
									<p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No recipe pairing suggestions available</p>
								)}
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
