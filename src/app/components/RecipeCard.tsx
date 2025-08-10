import Link from 'next/link';
import { Recipe } from '@/types/menus';
import { SwapIcon, RemoveIcon, TimeIcon } from './Icons';

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
			className={`relative bg-surface border border-custom rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-shadow max-w-[310px] w-full flex flex-col`}
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
							<TimeIcon />
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
							<SwapIcon />
						</button>
					)}
					{onRemoveRecipe && (
						<button
							onClick={() => onRemoveRecipe(recipe)}
							className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white flex items-center justify-center transition-all"
							title="Remove recipe"
						>
							<RemoveIcon />
						</button>
					)}
				</>
			)}
		</article>
	);
};

export default RecipeCard;
