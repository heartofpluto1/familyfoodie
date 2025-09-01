import { TimeIcon } from '@/app/components/Icons';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';
import { FireIcon } from '@heroicons/react/24/outline';

interface PopularRecipeCardProps {
	name: string;
	imageFilename: string | null;
	cookTime: number;
	prepTime: number | null;
	planCount: number;
}

export default function PopularRecipeCard({ name, imageFilename, cookTime, prepTime, planCount }: PopularRecipeCardProps) {
	const totalTime = cookTime + (prepTime || 0);

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
		<article className="relative bg-surface border border-custom rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-400 max-w-[310px] w-full flex flex-col group cursor-pointer">
			{/* Image - matching RecipeCard aspect-square style */}
			<div className="block">
				<img
					className="w-full aspect-square object-cover"
					alt={`${name} recipe`}
					src={getRecipeImageUrl(imageFilename)}
					onError={e => {
						e.currentTarget.src = '/onerror_recipe.png';
					}}
				/>
			</div>

			{/* Content - matching RecipeCard padding and structure */}
			<div className="p-4 flex flex-col flex-grow">
				<h3 className="text-lg text-foreground mb-2">{name}</h3>

				{/* Only show popularity badge if count is meaningful (>5) */}
				{planCount > 5 && (
					<div className="inline-block bg-blue-600 text-white text-xs px-2 py-1 rounded-full mb-2 w-fit flex items-center gap-1">
						<FireIcon className="w-3 h-3" />
						{planCount} families this month
					</div>
				)}

				<div className="mt-auto">
					{totalTime > 0 && (
						<p className="text-sm text-muted flex items-center">
							<TimeIcon />
							{formatTime(totalTime)}
						</p>
					)}
				</div>
			</div>

			{/* CTA Overlay on Hover */}
			<div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
				<div className="text-center text-white p-4">
					<p className="text-lg font-semibold mb-2">Sign in to view recipe</p>
					<p className="text-sm opacity-90">Join hundreds of families planning meals</p>
				</div>
			</div>
		</article>
	);
}
