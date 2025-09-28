import React, { useState, useMemo, useEffect } from 'react';
import { Recipe } from '@/types/menus';
import { RecipeFilterOptions, SearchState } from '@/types/plan';
import styles from '../plan.module.css';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';

interface RecipeSearchProps {
	recipes: Recipe[];
	onAddRecipe: (recipe: Recipe) => void;
	excludeIds: number[];
}

export function RecipeSearch({ recipes, onAddRecipe, excludeIds }: RecipeSearchProps) {
	const [searchState, setSearchState] = useState<SearchState>({
		searchTerm: '',
		showResults: false,
	});

	const filterOptions: RecipeFilterOptions = {
		searchTerm: searchState.searchTerm,
		excludeIds,
		maxResults: 10,
	};

	const filteredRecipes = useMemo(() => {
		if (!filterOptions.searchTerm) return [];

		const available = recipes.filter(recipe => !filterOptions.excludeIds.includes(recipe.id));

		return available
			.filter(
				recipe =>
					recipe.name.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
					recipe.description?.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
					recipe.ingredients?.some(ingredient => ingredient.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()))
			)
			.slice(0, filterOptions.maxResults);
	}, [filterOptions.searchTerm, recipes, filterOptions.excludeIds, filterOptions.maxResults]);

	const handleInputChange = (value: string) => {
		setSearchState({
			searchTerm: value,
			showResults: true,
		});
	};

	const handleRecipeSelect = (recipe: Recipe) => {
		onAddRecipe(recipe);
		setSearchState({
			searchTerm: '',
			showResults: false,
		});
	};

	const handleFocus = () => {
		setSearchState(prev => ({ ...prev, showResults: true }));
	};

	const handleClickOutside = () => {
		setSearchState(prev => ({ ...prev, showResults: false }));
	};

	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setSearchState(prev => ({ ...prev, showResults: false }));
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, []);

	return (
		<div className={styles.recipeSearch}>
			<input
				type="text"
				value={searchState.searchTerm}
				onChange={e => handleInputChange(e.target.value)}
				onFocus={handleFocus}
				placeholder="Search recipes by name, description, or ingredient..."
				className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				aria-label="Search recipes"
				aria-haspopup="listbox"
			/>

			{searchState.showResults && searchState.searchTerm && (
				<div className={styles.searchResults} role="listbox" aria-label="Recipe search results">
					{filteredRecipes.map(recipe => (
						<div
							key={`${recipe.collection_id || 0}-${recipe.id}`}
							className={styles.searchResultItem}
							onClick={() => handleRecipeSelect(recipe)}
							tabIndex={0}
							onKeyDown={e => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleRecipeSelect(recipe);
								}
							}}
						>
							<div className="flex items-center space-x-3">
								<img src={getRecipeImageUrl(recipe.image_filename)} alt={recipe.name} className="w-12 h-12 rounded object-cover" />
								<div className="flex-1">
									<div className="font-medium text-gray-900 dark:text-gray-100">
										{recipe.name}
										{recipe.collection_title && <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({recipe.collection_title})</span>}
									</div>
									{recipe.description && <div className="text-sm text-gray-600 dark:text-gray-400">{recipe.description.substring(0, 60)}...</div>}
								</div>
							</div>
						</div>
					))}
					{filteredRecipes.length === 0 && searchState.searchTerm && (
						<div className={`${styles.searchResultItem} text-gray-500 dark:text-gray-400`}>
							No recipes found matching &quot;{searchState.searchTerm}&quot;
						</div>
					)}
				</div>
			)}

			{searchState.showResults && <div className={styles.searchOverlay} onClick={handleClickOutside} aria-hidden="true" />}
		</div>
	);
}
