import Link from 'next/link';
import { Recipe } from '@/types/menus';

interface RecipeCardProps {
	recipe: Recipe;
	showControls?: boolean;
	onSwapRecipe?: (recipe: Recipe) => void;
	onRemoveRecipe?: (recipe: Recipe) => void;
}

const RecipeCard = ({ recipe, showControls = false, onSwapRecipe, onRemoveRecipe }: RecipeCardProps) => {
	const { id, name, filename, prepTime, cookTime, cost } = recipe;
	const totalTime = (prepTime || 0) + (cookTime || 0);

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
		<article
			className={`relative bg-surface border border-custom rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow max-w-[310px] w-full flex flex-col`}
		>
			<Link href={`/recipe/${id}`} className="block">
				<img className="w-full aspect-square object-cover" alt={`${name} recipe`} src={`/static/${filename}.jpg`} />
			</Link>

			<div className="p-4 flex flex-col flex-grow">
				<Link href={`/recipe/${id}`}>
					<h3 className="text-lg font-semibold text-foreground mb-2">{name}</h3>
				</Link>

				{cost && <div className="inline-block bg-accent text-background text-xs px-2 py-1 rounded-full mb-2 w-fit">£{cost.toFixed(2)}</div>}

				<div className="mt-auto">
					{totalTime > 0 && (
						<p className="text-sm text-muted flex items-center">
							<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<circle cx="12" cy="12" r="10" />
								<polyline points="12,6 12,12 16,14" />
							</svg>
							{formatTime(totalTime)}
						</p>
					)}
				</div>
			</div>

			{showControls && (
				<>
					{onSwapRecipe && (
						<button
							onClick={() => onSwapRecipe(recipe)}
							className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white flex items-center justify-center transition-all"
							title="Swap recipe"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
						</button>
					)}
					{onRemoveRecipe && (
						<button
							onClick={() => onRemoveRecipe(recipe)}
							className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white flex items-center justify-center transition-all"
							title="Remove recipe"
						>
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					)}
				</>
			)}
		</article>
	);
};

export default RecipeCard;
