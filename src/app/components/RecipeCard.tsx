import Link from 'next/link';
import { Recipe } from '@/types/menus';
import { SwapIcon, RemoveIcon, TimeIcon, CheckCircleIcon } from './Icons';
import React, { useState } from 'react';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';
import { generateRecipeUrl } from '@/lib/utils/urlHelpers';

interface RecipeCardProps {
	recipe: Recipe;
	showControls?: boolean;
	onSwapRecipe?: (recipe: Recipe) => Promise<Recipe | null>;
	onCommitSwap?: (recipeToReplace: Recipe, newRecipe: Recipe) => void;
	onRemoveRecipe?: (recipe: Recipe) => void;
	triggerAnimation?: boolean;
	newRecipe?: Recipe | null;
	onAnimationComplete?: () => void;
	isSelecting?: boolean;
	isSelected?: boolean;
	onToggleSelection?: (recipeId: number) => void;
	openInNewTab?: boolean;
	shop_qty?: 2 | 4;
	onShopQtyChange?: (recipeId: number, shopQty: 2 | 4) => void;
}

const RecipeCard = ({
	recipe,
	showControls = false,
	onSwapRecipe,
	onCommitSwap,
	onRemoveRecipe,
	triggerAnimation,
	newRecipe,
	onAnimationComplete,
	isSelecting = false,
	isSelected = false,
	onToggleSelection,
	openInNewTab = false,
	shop_qty,
	onShopQtyChange,
}: RecipeCardProps) => {
	const [displayRecipe, setDisplayRecipe] = useState(recipe);
	const [isFlipping, setIsFlipping] = useState(false);
	const [showNewContent, setShowNewContent] = useState(false);

	// Update displayRecipe when recipe prop changes (from parent state)
	React.useEffect(() => {
		if (!isFlipping) {
			setDisplayRecipe(recipe);
		}
	}, [recipe, isFlipping]);

	// Handle external animation trigger (for Automate button)
	React.useEffect(() => {
		if (triggerAnimation && newRecipe && newRecipe.id !== displayRecipe.id) {
			setIsFlipping(true);

			// After half rotation, swap content and counter the mirror
			setTimeout(() => {
				setDisplayRecipe(newRecipe);
				setShowNewContent(true);
			}, 150);

			// After full animation, notify completion
			setTimeout(() => {
				setIsFlipping(false);
				setShowNewContent(false);
				if (onAnimationComplete) {
					onAnimationComplete();
				}
			}, 300);
		}
	}, [triggerAnimation, newRecipe, displayRecipe.id, onAnimationComplete]);

	const { name, image_filename, prepTime, cookTime, cost } = displayRecipe;
	const totalTime = (prepTime || 0) + (cookTime || 0);

	const handleSwapRecipe = async () => {
		if (!onSwapRecipe || isFlipping) return;

		// Call onSwapRecipe immediately to fetch new recipe (updates loading state)
		const newRecipe = await onSwapRecipe(recipe);

		// Only start animation if we got a new recipe
		if (newRecipe) {
			// Preload the new recipe image before starting animation
			const img = new Image();
			img.src = getRecipeImageUrl(newRecipe.image_filename);

			// Start animation when image is loaded (or immediately if already cached)
			img.onload = () => {
				setIsFlipping(true);

				// After half rotation, swap content and counter the mirror
				setTimeout(() => {
					setDisplayRecipe(newRecipe);
					setShowNewContent(true);
				}, 150);

				// After full animation, update parent state and reset
				setTimeout(() => {
					if (onCommitSwap) {
						onCommitSwap(recipe, newRecipe);
					}
					setIsFlipping(false);
					setShowNewContent(false);
				}, 300);
			};

			// Handle image load error - start animation anyway to avoid hanging
			img.onerror = () => {
				setIsFlipping(true);

				setTimeout(() => {
					setDisplayRecipe(newRecipe);
					setShowNewContent(true);
				}, 150);

				setTimeout(() => {
					if (onCommitSwap) {
						onCommitSwap(recipe, newRecipe);
					}
					setIsFlipping(false);
					setShowNewContent(false);
				}, 300);
			};
		}
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

	const handleCardClick = (e: React.MouseEvent) => {
		if (isSelecting && onToggleSelection) {
			e.preventDefault();
			e.stopPropagation();
			onToggleSelection(recipe.id);
		}
	};

	const CardContent = () => (
		<>
			<div className="block">
				<img
					className="w-full aspect-square object-cover"
					alt={`${name} recipe`}
					src={getRecipeImageUrl(image_filename)}
					onError={e => {
						e.currentTarget.src = '/onerror_recipe.png';
					}}
				/>
			</div>

			<div className="p-4 flex flex-col flex-grow">
				<h3 className="text-lg text-foreground mb-2">{name}</h3>

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
		</>
	);

	return (
		<div className="recipe-card-container" style={{ perspective: '1000px' }}>
			<article
				className={`relative bg-surface border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-custom'} rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 max-w-[310px] w-full flex flex-col ${isSelecting ? 'cursor-pointer' : ''}`}
				style={{
					transformStyle: 'preserve-3d',
					transition: 'transform 0.3s ease-in-out',
					transform: isFlipping ? 'rotateY(180deg)' : 'rotateY(0deg)',
				}}
			>
				<div
					className="w-full h-full flex flex-col"
					style={{
						transform: showNewContent ? 'scaleX(-1)' : 'none',
						transition: 'none',
					}}
				>
					{isSelecting ? (
						// In selection mode, render content without links
						<div onClick={handleCardClick} className="w-full h-full flex flex-col">
							<CardContent />
						</div>
					) : (
						// Normal mode, render with links
						<>
							<Link
								href={generateRecipeUrl(displayRecipe)}
								className="block"
								target={openInNewTab ? '_blank' : undefined}
								rel={openInNewTab ? 'noopener noreferrer' : undefined}
							>
								<img
									className="w-full aspect-square object-cover"
									alt={`${name} recipe`}
									src={getRecipeImageUrl(image_filename)}
									onError={e => {
										e.currentTarget.src = '/onerror_recipe.png';
									}}
								/>
							</Link>

							<div className="p-4 flex flex-col flex-grow">
								<Link
									href={generateRecipeUrl(displayRecipe)}
									target={openInNewTab ? '_blank' : undefined}
									rel={openInNewTab ? 'noopener noreferrer' : undefined}
								>
									<h3 className="text-lg text-foreground mb-2">{name}</h3>
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
						</>
					)}
				</div>

				{/* Selection overlay - appears in selection mode to capture all clicks */}
				{isSelecting && (
					<div
						className="absolute inset-0 z-10 bg-transparent hover:bg-black/10 transition-colors"
						onClick={handleCardClick}
						style={{ cursor: 'pointer' }}
					>
						{/* Selection indicator */}
						{isSelected && (
							<div className="absolute top-2 right-2">
								<CheckCircleIcon className="w-6 h-6 text-blue-500" />
							</div>
						)}
					</div>
				)}

				{showControls && (
					<>
						{onSwapRecipe && (
							<button
								onClick={handleSwapRecipe}
								className={`absolute top-2 w-8 h-8 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white flex items-center justify-center transition-all ${showNewContent ? 'right-2' : 'left-2'}`}
								title="Swap recipe"
								disabled={isFlipping}
								style={{
									transform: showNewContent ? 'scaleX(-1)' : 'none',
									transition: 'none',
								}}
							>
								<SwapIcon />
							</button>
						)}
						{onRemoveRecipe && (
							<button
								onClick={() => onRemoveRecipe(recipe)}
								className={`absolute top-2 w-8 h-8 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white flex items-center justify-center transition-all ${showNewContent ? 'left-2' : 'right-2'}`}
								title="Remove recipe"
								style={{
									transform: showNewContent ? 'scaleX(-1)' : 'none',
									transition: 'none',
								}}
							>
								<RemoveIcon />
							</button>
						)}
						{onShopQtyChange && shop_qty && (
							<button
								onClick={e => {
									e.stopPropagation();
									const newQty = shop_qty === 2 ? 4 : 2;
									onShopQtyChange(recipe.id, newQty as 2 | 4);
								}}
								className={`absolute top-[238px] w-8 h-8 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 text-white flex items-center justify-center transition-all text-xs font-semibold ${showNewContent ? 'right-2' : 'left-2'}`}
								title="Shop quantity"
								style={{
									transform: showNewContent ? 'scaleX(-1)' : 'none',
									transition: 'none',
								}}
							>
								{shop_qty}p
							</button>
						)}
					</>
				)}
			</article>
		</div>
	);
};

export default RecipeCard;
