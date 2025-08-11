import React from 'react';
import { Recipe } from '@/types/menus';
import { PlusIcon } from '@/app/components/Icons';
import { RecipeSearch } from './RecipeSearch';
import styles from '../plan.module.css';

interface AddRecipeCardProps {
	allRecipes: Recipe[];
	excludeIds: number[];
	isLoading: boolean;
	onAddRecipe: (recipe: Recipe) => void;
	onAddRandomRecipe: () => Promise<void>;
}

export function AddRecipeCard({ allRecipes, excludeIds, isLoading, onAddRecipe, onAddRandomRecipe }: AddRecipeCardProps) {
	return (
		<div className={styles.addRecipeCard}>
			<div className={styles.addRecipeContent}>
				<div className="flex flex-col items-center mb-4">
					<h3 className="text-lg mb-3 text-gray-900 dark:text-gray-100">Add Recipe</h3>
					<button
						onClick={onAddRandomRecipe}
						disabled={isLoading}
						className="w-10 h-10 rounded-full bg-gray-600 hover:bg-gray-700 text-white flex items-center justify-center transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
						title="Add random compatible recipe"
						aria-label="Add random compatible recipe"
					>
						<PlusIcon />
					</button>
				</div>
				<RecipeSearch recipes={allRecipes} onAddRecipe={onAddRecipe} excludeIds={excludeIds} />
			</div>
		</div>
	);
}
