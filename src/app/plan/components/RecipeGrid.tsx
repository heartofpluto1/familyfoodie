import React from 'react';
import { Recipe } from '@/types/menus';
import { RecipeManagementActions } from '@/types/plan';
import RecipeCard from '@/app/components/RecipeCard';
import { AddRecipeCard } from './AddRecipeCard';

interface RecipeGridProps {
	recipes: Recipe[];
	allRecipes: Recipe[];
	isEditMode: boolean;
	isLoading: boolean;
	recipeActions: RecipeManagementActions;
}

export function RecipeGrid({ recipes, allRecipes, isEditMode, isLoading, recipeActions }: RecipeGridProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{recipes.map(recipe => (
				<RecipeCard
					key={recipe.id}
					recipe={recipe}
					showControls={isEditMode}
					onSwapRecipe={recipeActions.handleSwapRecipe}
					onRemoveRecipe={recipeActions.handleRemoveRecipe}
				/>
			))}

			{isEditMode && (
				<AddRecipeCard
					allRecipes={allRecipes}
					excludeIds={recipes.map(r => r.id)}
					isLoading={isLoading}
					onAddRecipe={recipeActions.handleAddRecipe}
					onAddRandomRecipe={recipeActions.handleAddRandomRecipe}
				/>
			)}
		</div>
	);
}
