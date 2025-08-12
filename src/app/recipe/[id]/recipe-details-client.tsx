'use client';

import { RecipeDetail } from '@/types/menus';
import HeaderPage from '@/app/components/HeaderPage';
import { TimeIcon, DownloadIcon } from '@/app/components/Icons';
import Tooltip from '@/app/components/Tooltip';
import { getPantryCategoryColor } from '@/lib/utils/categoryColors';

interface RecipeDetailsClientProps {
	recipe: RecipeDetail;
}

const RecipeDetailsClient = ({ recipe }: RecipeDetailsClientProps) => {
	const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

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
					<HeaderPage title={recipe.name} subtitle={recipe.seasonName ? `${recipe.seasonName} Recipe` : ''} />
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<div className="bg-white border border-custom rounded-sm shadow-md overflow-hidden">
						{/* Recipe Image */}
						<img src={`/static/${recipe.filename}.jpg`} alt={recipe.name} className="w-full" />

						<div className="p-6 space-y-4">
							{/* Tags and PDF Link */}
							<div className="flex items-center justify-between flex-wrap gap-2">
								{/* Season and Ingredients Tags */}
								<div className="flex flex-wrap gap-2">
									{recipe.seasonName && (
										<span className="inline-flex items-center px-2 py-1 bg-accent/50 text-foreground rounded-sm text-xs font-medium">
											{recipe.seasonName}
										</span>
									)}
									{recipe.primaryTypeName && (
										<span className="inline-flex items-center px-2 py-1 bg-accent/50 text-foreground rounded-sm text-xs font-medium">
											Protein: {recipe.primaryTypeName}
										</span>
									)}
									{recipe.secondaryTypeName && (
										<span className="inline-flex items-center px-2 py-1 bg-accent/50 text-foreground rounded-sm text-xs font-medium">
											Carb: {recipe.secondaryTypeName}
										</span>
									)}
								</div>

								{/* PDF Link */}
								<a
									href={`/static/${recipe.filename}.pdf`}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center px-2 py-1 bg-accent text-background rounded-sm hover:bg-accent/90 transition-colors text-xs"
								>
									<DownloadIcon className="w-4 h-4 mr-1" />
									PDF Recipe
								</a>
							</div>

							{/* Timing */}
							{totalTime > 0 && (
								<div className="flex items-center text-muted text-sm">
									<TimeIcon className="w-5 h-5 mr-2" />
									{recipe.prepTime && recipe.cookTime ? (
										<span>
											Prep: {formatTime(recipe.prepTime)} • Cook: {formatTime(recipe.cookTime)} • Total: {formatTime(totalTime)}
										</span>
									) : (
										<span>Total Time: {formatTime(totalTime)}</span>
									)}
								</div>
							)}

							{/* Description */}
							{recipe.description && (
								<div>
									<p className="text-foreground whitespace-pre-wrap">{recipe.description}</p>
								</div>
							)}
						</div>
					</div>

					{/* Recipe Details */}
					<div className="space-y-6">
						{/* Ingredients */}
						<div>
							<div className="overflow-visible bg-white border border-custom rounded-sm shadow-md overflow-hidden">
								<div className="overflow-visible">
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
												<tr key={ingredient.id} className="border-b border-light">
													<td className="p-0">
														<div className="flex items-stretch h-full">
															{ingredient.ingredient.pantryCategory?.name && (
																<div className="flex items-center relative group">
																	<div
																		className="block w-1 h-full min-h-10"
																		style={{
																			cursor: 'pointer',
																			backgroundColor: getPantryCategoryColor(ingredient.ingredient.pantryCategory.name, true),
																		}}
																	></div>
																	<Tooltip
																		text={ingredient.ingredient.pantryCategory.name}
																		backgroundColor={getPantryCategoryColor(ingredient.ingredient.pantryCategory.name, false)}
																	/>
																</div>
															)}
															<div className="flex items-center px-2 py-2 flex-1">
																<span className="text-sm">
																	{ingredient.ingredient.name}
																	{ingredient.preperation && <span className="text-muted ml-1">({ingredient.preperation.name})</span>}
																</span>
															</div>
														</div>
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
