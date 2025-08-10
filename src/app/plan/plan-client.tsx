'use client';

import { useState, useMemo } from 'react';
import { Recipe } from '@/types/menus';
import HeaderPage from '@/app/components/HeaderPage';
import RecipeCard from '@/app/components/RecipeCard';
import { PlusIcon } from '@/app/components/Icons';
import { useToast } from '@/app/components/ToastProvider';

interface PlanClientProps {
	week: number;
	year: number;
	weekDates: string;
	initialRecipes: Recipe[];
	allRecipes: Recipe[];
}

interface RecipeSearchProps {
	recipes: Recipe[];
	onAddRecipe: (recipe: Recipe) => void;
	excludeIds: number[];
}

const RecipeSearch = ({ recipes, onAddRecipe, excludeIds }: RecipeSearchProps) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [showResults, setShowResults] = useState(false);

	const filteredRecipes = useMemo(() => {
		if (!searchTerm) return [];

		const available = recipes.filter(recipe => !excludeIds.includes(recipe.id));

		return available
			.filter(
				recipe =>
					recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					recipe.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					recipe.ingredients?.some(ingredient => ingredient.toLowerCase().includes(searchTerm.toLowerCase()))
			)
			.slice(0, 10);
	}, [searchTerm, recipes, excludeIds]);

	return (
		<div className="recipe-search">
			<input
				type="text"
				value={searchTerm}
				onChange={e => {
					setSearchTerm(e.target.value);
					setShowResults(true);
				}}
				onFocus={() => setShowResults(true)}
				placeholder="Search recipes by name, description, or ingredient..."
				className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
			/>

			{showResults && searchTerm && (
				<div className="search-results">
					{filteredRecipes.map(recipe => (
						<div
							key={recipe.id}
							className="search-result-item"
							onClick={() => {
								onAddRecipe(recipe);
								setSearchTerm('');
								setShowResults(false);
							}}
						>
							<div className="flex items-center space-x-3">
								<img src={`/static/${recipe.filename}.jpg`} alt={recipe.name} className="w-12 h-12 rounded object-cover" />
								<div>
									<div className="font-medium">{recipe.name}</div>
									{recipe.description && <div className="text-sm text-gray-600">{recipe.description.substring(0, 60)}...</div>}
								</div>
							</div>
						</div>
					))}
					{filteredRecipes.length === 0 && searchTerm && (
						<div className="search-result-item text-gray-500">No recipes found matching &quot;{searchTerm}&quot;</div>
					)}
				</div>
			)}

			{showResults && <div className="search-overlay" onClick={() => setShowResults(false)} />}
		</div>
	);
};

const PlanClient = ({ week, year, weekDates, initialRecipes, allRecipes }: PlanClientProps) => {
	const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
	const [isEditMode, setIsEditMode] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const { showToast } = useToast();

	const handleEdit = async () => {
		setIsEditMode(true);

		// If no recipes exist for the week, pre-populate with automated selection
		if (recipes.length === 0) {
			setIsLoading(true);
			try {
				const response = await fetch('/api/plan/randomize');
				const data = await response.json();

				if (response.ok) {
					setRecipes(data.recipes);
				} else {
					showToast('error', 'Failed to randomize recipes: ' + (data.error || 'Unknown error'), 'error');
				}
			} catch (error) {
				showToast('error', 'Error randomizing recipes: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
			} finally {
				setIsLoading(false);
			}
		}
	};

	const handleCancel = () => {
		setIsEditMode(false);
		setRecipes(initialRecipes);
	};

	const handleAutomate = async () => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/plan/randomize');
			const data = await response.json();

			if (response.ok) {
				setRecipes(data.recipes);
			} else {
				showToast('error', 'Failed to randomize recipes: ' + (data.error || 'Unknown error'), 'error');
			}
		} catch (error) {
			showToast('error', 'Error randomizing recipes: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
		} finally {
			setIsLoading(false);
		}
	};

	const handleSave = async () => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/plan/save', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					week,
					year,
					recipeIds: recipes.map(r => r.id),
				}),
			});

			if (response.ok) {
				setIsEditMode(false);

				// Reset shopping list after successfully saving recipes
				try {
					const resetResponse = await fetch('/api/shop/reset', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week,
							year,
						}),
					});

					if (!resetResponse.ok) {
						showToast('error', 'Failed to reset shopping list', 'error');
					}
				} catch (resetError) {
					showToast('error', 'Error resetting shopping list: ' + (resetError instanceof Error ? resetError.message : 'Unknown error'), 'error');
				}
			} else {
				const data = await response.json();
				showToast('error', 'Failed to save recipes: ' + (data.error || 'Unknown error'), 'error');
			}
		} catch (error) {
			showToast('error', 'Error saving recipes: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (!confirm('Are you sure you want to delete all recipes for this week?')) {
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch('/api/plan/delete', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ week, year }),
			});

			if (response.ok) {
				setRecipes([]);
				setIsEditMode(false);

				// Reset shopping list after successfully deleting recipes
				try {
					const resetResponse = await fetch('/api/shop/reset', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week,
							year,
						}),
					});

					if (!resetResponse.ok) {
						showToast('error', 'Failed to reset shopping list', 'error');
					}
				} catch (resetError) {
					showToast('error', 'Error resetting shopping list: ' + (resetError instanceof Error ? resetError.message : 'Unknown error'), 'error');
				}
			} else {
				const data = await response.json();
				showToast('error', 'Failed to delete recipes: ' + (data.error || 'Unknown error'), 'error');
			}
		} catch (error) {
			showToast('error', 'Error deleting recipes: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
		} finally {
			setIsLoading(false);
		}
	};

	const handleSwapRecipe = async (recipeToReplace: Recipe) => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/plan/randomize');
			const data = await response.json();

			if (response.ok && data.recipes.length > 0) {
				// Get available recipes that aren't already in the list
				const currentIds = recipes.map(r => r.id);
				const availableReplacements = data.recipes.filter((r: Recipe) => !currentIds.includes(r.id));

				if (availableReplacements.length > 0) {
					const replacement = availableReplacements[0];
					setRecipes(prev => prev.map(r => (r.id === recipeToReplace.id ? replacement : r)));
				}
			}
		} catch (error) {
			showToast('error', 'Error swapping recipe: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
		} finally {
			setIsLoading(false);
		}
	};

	const handleRemoveRecipe = (recipeToRemove: Recipe) => {
		setRecipes(prev => prev.filter(r => r.id !== recipeToRemove.id));
	};

	const handleAddRecipe = (recipe: Recipe) => {
		setRecipes(prev => [...prev, recipe]);
	};

	const handleAddRandomRecipe = async () => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/plan/randomize');
			const data = await response.json();

			if (response.ok && data.recipes.length > 0) {
				// Get available recipes that aren't already in the list
				const currentIds = recipes.map(r => r.id);
				const availableRecipes = data.recipes.filter((r: Recipe) => !currentIds.includes(r.id));

				if (availableRecipes.length > 0) {
					// Apply the same ingredient constraint logic as the randomization function
					const currentRecipes = recipes;
					const usedPrimaryIngredients = new Set(currentRecipes.filter(r => r.ingredients && r.ingredients.length > 0).map(r => r.ingredients![0]));
					const usedSecondaryIngredients = new Set(currentRecipes.filter(r => r.ingredients && r.ingredients.length > 1).map(r => r.ingredients![1]));

					// Find a compatible recipe
					const compatibleRecipe = availableRecipes.find((recipe: Recipe) => {
						const ingredients = recipe.ingredients || [];
						if (ingredients.length === 0) return true;

						const primaryIngredient = ingredients[0];
						const secondaryIngredient = ingredients.length > 1 ? ingredients[1] : null;

						const primaryConflict = usedPrimaryIngredients.has(primaryIngredient);
						const secondaryConflict = secondaryIngredient && usedSecondaryIngredients.has(secondaryIngredient);

						return !primaryConflict && !secondaryConflict;
					});

					if (compatibleRecipe) {
						setRecipes(prev => [...prev, compatibleRecipe]);
					} else if (availableRecipes.length > 0) {
						// If no perfectly compatible recipe, just add the first available one
						setRecipes(prev => [...prev, availableRecipes[0]]);
					}
				}
			}
		} catch (error) {
			showToast('error', 'Error adding random recipe: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<main className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<HeaderPage title={`Week ${week} Plan`} subtitle={weekDates} />
				</div>

				{!isEditMode && (
					<div className="mb-6">
						<button
							onClick={handleEdit}
							disabled={isLoading}
							className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
						>
							{isLoading ? 'Loading recipes...' : 'Edit Week'}
						</button>
					</div>
				)}

				{isEditMode && (
					<div className="week-controls mb-6 flex gap-2 flex-wrap">
						<button
							onClick={handleAutomate}
							disabled={isLoading}
							className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
						>
							{isLoading ? 'Automating...' : 'Automate'}
						</button>
						<button
							onClick={handleSave}
							disabled={isLoading}
							className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
						>
							{isLoading ? 'Saving...' : 'Save'}
						</button>
						<button
							onClick={handleDelete}
							disabled={isLoading}
							className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
						>
							Delete
						</button>
						<button
							onClick={handleCancel}
							className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors"
						>
							Cancel
						</button>
					</div>
				)}

				<div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${isEditMode ? 'edit-mode' : ''}`}>
					{recipes.map(recipe => (
						<RecipeCard key={recipe.id} recipe={recipe} showControls={isEditMode} onSwapRecipe={handleSwapRecipe} onRemoveRecipe={handleRemoveRecipe} />
					))}

					{isEditMode && (
						<div className="add-recipe-card">
							<div className="add-recipe-content">
								<div className="flex flex-col items-center mb-4">
									<h3 className="text-lg font-semibold mb-3">Add Recipe</h3>
									<button
										onClick={handleAddRandomRecipe}
										disabled={isLoading}
										className="w-10 h-10 rounded-full bg-accent hover:bg-accent/90 text-background flex items-center justify-center transition-all disabled:opacity-50"
										title="Add random compatible recipe"
									>
										<PlusIcon />
									</button>
								</div>
								<RecipeSearch recipes={allRecipes} onAddRecipe={handleAddRecipe} excludeIds={recipes.map(r => r.id)} />
							</div>
						</div>
					)}
				</div>
			</main>

			<style jsx>{`
				.edit-mode {
					border: 5px dashed rgba(100, 100, 100, 0.3);
					padding: 1.5rem;
					border-radius: 0.5rem;
				}

				.add-recipe-card {
					border: 5px dashed rgba(100, 100, 100, 0.3);
					border-radius: 0.5rem;
					padding: 1.5rem;
					display: flex;
					align-items: center;
					justify-content: center;
					min-height: 380px;
					background: hsl(var(--card));
					max-width: 310px;
					width: 100%;
				}

				.add-recipe-content {
					width: 100%;
				}

				.add-recipe-content h3 {
					color: hsl(var(--foreground));
					margin: 0;
				}

				.recipe-search {
					position: relative;
				}

				.search-results {
					position: absolute;
					top: 100%;
					left: 0;
					right: 0;
					background: hsl(var(--popover));
					border: 1px solid hsl(var(--border));
					border-top: none;
					border-radius: 0 0 0.375rem 0.375rem;
					max-height: 300px;
					overflow-y: auto;
					z-index: 50;
					box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
				}

				.search-result-item {
					padding: 0.75rem;
					border-bottom: 1px solid hsl(var(--border));
					cursor: pointer;
					transition: background-color 0.2s;
					color: hsl(var(--foreground));
				}

				.search-result-item:hover {
					background: hsl(var(--accent));
				}

				.search-result-item:last-child {
					border-bottom: none;
				}

				.search-overlay {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					z-index: 40;
				}

				.week-controls {
					background: hsl(var(--muted));
					border-radius: 0.5rem;
					border: 2px solid hsl(var(--border));
				}

				/* Dark mode specific styles */
				@media (prefers-color-scheme: dark) {
					.edit-mode {
						border: 5px dashed rgba(200, 200, 200, 0.2);
					}

					.add-recipe-card {
						border: 5px dashed rgba(200, 200, 200, 0.2);
					}
				}
			`}</style>
		</>
	);
};

export default PlanClient;
