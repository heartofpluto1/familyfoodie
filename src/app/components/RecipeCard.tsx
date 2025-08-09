import Link from 'next/link';
import { Recipe } from '@/types/menus';

interface RecipeCardProps {
	recipe: Recipe;
	small?: boolean;
}

const RecipeCard = ({ recipe, small = false }: RecipeCardProps) => {
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
			className={`bg-surface border border-custom rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow ${small ? 'max-w-sm' : 'max-w-md'} flex flex-col`}
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
		</article>
	);
};

export default RecipeCard;
