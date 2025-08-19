'use client';

import { RecipeDetail } from '@/types/menus';
import { TimeIcon, DownloadIcon } from '@/app/components/Icons';

interface RecipeViewProps {
	recipe: RecipeDetail;
}

const RecipeView = ({ recipe }: RecipeViewProps) => {
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
			{/* Tags and PDF Link */}
			<div className="flex items-center justify-between flex-wrap gap-2">
				{/* Season and Ingredients Tags */}
				<div className="flex flex-wrap gap-2">
					{recipe.seasonName && (
						<span className="inline-flex items-center px-2 py-1 bg-accent/50 text-foreground rounded-sm text-xs font-medium">{recipe.seasonName}</span>
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
		</>
	);
};

export default RecipeView;
