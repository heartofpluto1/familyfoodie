'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Recipe } from '@/types/menus';
import RecipeCard from './RecipeCard';
import RecipeSearch from './RecipeSearch';
import { SparklesIcon } from './Icons';

interface RecipeListProps {
	recipes: Recipe[];
}

const RecipeList = ({ recipes }: RecipeListProps) => {
	const searchParams = useSearchParams();
	const [searchTerm, setSearchTerm] = useState('');

	// Initialize search term from URL parameters
	useEffect(() => {
		const searchParam = searchParams.get('search');
		if (searchParam) {
			setSearchTerm(searchParam);
		}
	}, [searchParams]);

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
			<div className="mb-6 flex items-start justify-between gap-4">
				<div className="flex gap-3 flex-shrink-0">
					<Link
						href="/recipe/import"
						className="inline-flex items-center bg-accent hover:bg-accent/90 gap-2 px-4 py-2 text-white rounded-sm transition-colors"
					>
						<SparklesIcon className="w-4 h-4" />
						PDF Import (powered by AI)
					</Link>
				</div>
				<div className="flex-1 max-w-md">
					<RecipeSearch onSearch={setSearchTerm} resultsCount={filteredRecipes.length} totalCount={recipes.length} initialSearchTerm={searchTerm} />
				</div>
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
