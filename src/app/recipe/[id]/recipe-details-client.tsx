'use client';

import { RecipeDetail } from '@/types/menus';
import HeaderPage from '../../components/HeaderPage';

interface RecipeDetailsClientProps {
	recipe: RecipeDetail;
}

const RecipeDetailsClient = ({ recipe }: RecipeDetailsClientProps) => {
	const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

	const getPantryCategoryClass = (category?: string): string => {
		if (!category) return '';
		return `pantry-category-${category.toLowerCase().replace(/ /g, '-')}`;
	};

	const formatTime = (minutes: number): string => {
		if (minutes >= 60) {
			const hours = Math.floor(minutes / 60);
			const remainingMinutes = minutes % 60;
			if (remainingMinutes === 0) {
				return `${hours}h`;
			}
			return `${hours}h ${remainingMinutes}m`;
		}
		return `${minutes} min`;
	};

	return (
		<>
			<main className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<HeaderPage title={recipe.name} subtitle={recipe.seasonName ? `${recipe.seasonName} Recipe` : 'Recipe Details'} />
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Recipe Image */}
					<div className="space-y-4">
						<img src={`/static/${recipe.filename}.jpg`} alt={recipe.name} className="w-full rounded-lg shadow-md" />

						{/* Timing */}
						{totalTime > 0 && (
							<div>
								<div className="flex items-center text-muted text-sm">
									<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<circle cx="12" cy="12" r="10" />
										<polyline points="12,6 12,12 16,14" />
									</svg>
									{recipe.prepTime && recipe.cookTime ? (
										<span>
											Prep: {formatTime(recipe.prepTime)} • Cook: {formatTime(recipe.cookTime)} • Total: {formatTime(totalTime)}
										</span>
									) : (
										<span>Total Time: {formatTime(totalTime)}</span>
									)}
								</div>
							</div>
						)}

						{/* Description */}
						<div>
							<p className="text-foreground whitespace-pre-wrap">{recipe.description}</p>
						</div>

						{/* PDF Link */}
						<div className="flex justify-center">
							<a
								href={`/static/${recipe.filename}.pdf`}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center px-4 py-2 bg-accent text-background rounded-md hover:bg-accent/90 transition-colors"
							>
								<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								View PDF Recipe
							</a>
						</div>
					</div>

					{/* Recipe Details */}
					<div className="space-y-6">
						{/* Ingredients */}
						<div>
							<div className="bg-white border border-custom rounded-lg shadow-md overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b border-light">
												<th className="px-2 py-3 text-left text-sm font-medium">Ingredients</th>
												<th className="px-2 py-3 text-center text-sm font-medium w-30">2p</th>
												<th className="px-2 py-3 text-center text-sm font-medium w-30">4p</th>
											</tr>
										</thead>
										<tbody>
											{recipe.ingredients.map(ingredient => (
												<tr
													key={ingredient.id}
													className={`border-b border-light transition-colors ${getPantryCategoryClass(ingredient.ingredient.pantryCategory.name)}`}
												>
													<td className="px-2 py-2">
														<span className="text-sm">
															{ingredient.ingredient.name}
															{ingredient.preperation && <span className="text-muted ml-1">({ingredient.preperation.name})</span>}
														</span>
													</td>
													<td className="px-2 py-2 text-center text-sm">
														{ingredient.quantity}&nbsp;{ingredient.measure ? ` ${ingredient.measure.name}` : ''}
													</td>
													<td className="px-2 py-2 text-center text-sm">
														{ingredient.quantity4}&nbsp;{ingredient.measure ? ` ${ingredient.measure.name}` : ''}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
		</>
	);
};

export default RecipeDetailsClient;
