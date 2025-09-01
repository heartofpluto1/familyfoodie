import Image from 'next/image';
import { ClockIcon, FireIcon } from '@heroicons/react/24/outline';

interface PopularRecipeCardProps {
	name: string;
	imageFilename: string | null;
	cookTime: number;
	prepTime: number | null;
	planCount: number;
}

export default function PopularRecipeCard({ name, imageFilename, cookTime, prepTime, planCount }: PopularRecipeCardProps) {
	const totalTime = cookTime + (prepTime || 0);
	const imagePath = imageFilename ? `/static/recipes/${imageFilename}` : '/static/recipes/default-recipe.jpg';

	return (
		<div className="group relative bg-surface border border-custom rounded-sm overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer">
			{/* Image Container */}
			<div className="relative h-48 w-full overflow-hidden bg-gray-100">
				<Image
					src={imagePath}
					alt={name}
					fill
					className="object-cover group-hover:scale-105 transition-transform duration-300"
					sizes="(max-width: 768px) 100vw, 33vw"
				/>
				{/* Popularity Badge */}
				<div className="absolute top-2 right-2 bg-accent text-white px-2 py-1 rounded-sm text-xs font-semibold flex items-center gap-1">
					<FireIcon className="w-3 h-3" />
					{planCount} this month
				</div>
			</div>

			{/* Content */}
			<div className="p-4">
				<h3 className="text-foreground font-semibold text-lg mb-2 line-clamp-2">{name}</h3>

				<div className="flex items-center gap-4 text-secondary text-sm">
					<div className="flex items-center gap-1">
						<ClockIcon className="w-4 h-4" />
						<span>{totalTime} min</span>
					</div>
				</div>

				{/* CTA Overlay on Hover */}
				<div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
					<div className="text-center text-white p-4">
						<p className="text-lg font-semibold mb-2">Sign in to view recipe</p>
						<p className="text-sm opacity-90">Join hundreds of families planning meals</p>
					</div>
				</div>
			</div>
		</div>
	);
}
