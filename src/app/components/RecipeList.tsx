'use client';

import { useState, useMemo } from 'react';
import { Recipe } from '@/types/menus';
import RecipeCard from './RecipeCard';
import RecipeSearch from './RecipeSearch';

interface RecipeListProps {
	recipes: Recipe[];
}

const RecipeList = ({ recipes }: RecipeListProps) => {
	const [searchTerm, setSearchTerm] = useState('');

	const filteredRecipes = useMemo(() => {
		if (!searchTerm.trim()) {
			return recipes;
		}

		const search = searchTerm.toLowerCase();
		return recipes.filter(recipe => {
			// Search in recipe name
			if (recipe.name.toLowerCase().includes(search)) {
				return true;
			}

			// Search in description
			if (recipe.description && recipe.description.toLowerCase().includes(search)) {
				return true;
			}

			// Search in season name
			if (recipe.seasonName && recipe.seasonName.toLowerCase().includes(search)) {
				return true;
			}

			// Search in ingredients
			if (recipe.ingredients && recipe.ingredients.some(ingredient => ingredient.toLowerCase().includes(search))) {
				return true;
			}

			return false;
		});
	}, [recipes, searchTerm]);

	return (
		<>
			<div className="mb-8 flex justify-end">
				<RecipeSearch onSearch={setSearchTerm} resultsCount={filteredRecipes.length} totalCount={recipes.length} />
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{filteredRecipes.map(recipe => (
					<RecipeCard key={recipe.id} recipe={recipe} />
				))}
			</div>

			{filteredRecipes.length === 0 && searchTerm && (
				<div className="text-center py-12">
					<p className="text-muted text-lg">No recipes found for &quot;{searchTerm}&quot;.</p>
					<p className="text-sm text-muted mt-2">Try searching with different keywords or ingredients.</p>
				</div>
			)}

			{recipes.length === 0 && (
				<div className="text-center py-12">
					<p className="text-muted text-lg">No recipes found.</p>
				</div>
			)}
		</>
	);
};

export default RecipeList;
