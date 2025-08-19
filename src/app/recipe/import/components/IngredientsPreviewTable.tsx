'use client';

import { RecipeIngredient } from '@/types/menus';
import { TrashIcon, PlusIcon } from '@/app/components/Icons';
import Tooltip from '@/app/components/Tooltip';
import { getPantryCategoryColor } from '@/lib/utils/categoryColors';
import { RecipeOptions } from '../utils/recipeUtils';
import { Category } from '../types/importTypes';

interface ExtendedRecipeIngredient extends RecipeIngredient {
	existing_ingredient_id?: number;
	fresh?: boolean;
	pantryCategory_id?: number;
	supermarketCategory_id?: number;
	manually_added?: boolean; // Flag for manually added ingredients
}

interface IngredientsPreviewTableProps {
	ingredients: ExtendedRecipeIngredient[];
	onIngredientsChange: (ingredients: ExtendedRecipeIngredient[]) => void;
	options: RecipeOptions | null;
	categories?: { pantryCategories: Category[]; supermarketCategories: Category[] } | null;
}

const IngredientsPreviewTable = ({ ingredients, onIngredientsChange, options, categories }: IngredientsPreviewTableProps) => {
	const handleQuantityChange = (id: number, field: 'quantity' | 'quantity4', value: string) => {
		const updated = ingredients.map(ing => (ing.id === id ? { ...ing, [field]: value } : ing));
		onIngredientsChange(updated);
	};

	const handleMeasureChange = (id: number, measureId: string) => {
		const measure = measureId ? options?.measures.find(m => m.id === parseInt(measureId)) : undefined;
		const updated = ingredients.map(ing =>
			ing.id === id
				? {
						...ing,
						measure: measure ? { id: measure.id, name: measure.name } : undefined,
					}
				: ing
		);
		onIngredientsChange(updated);
	};

	const handleIngredientNameChange = (id: number, name: string) => {
		const updated = ingredients.map(ing =>
			ing.id === id
				? {
						...ing,
						ingredient: { ...ing.ingredient, name },
					}
				: ing
		);
		onIngredientsChange(updated);
	};

	const handleDeleteIngredient = (id: number) => {
		const updated = ingredients.filter(ing => ing.id !== id);
		onIngredientsChange(updated);
	};

	const handleCategoryChange = (id: number, field: 'pantryCategory_id' | 'supermarketCategory_id', value: number) => {
		const updated = ingredients.map(ing => (ing.id === id ? { ...ing, [field]: value } : ing));
		onIngredientsChange(updated);
	};

	const handleFreshChange = (id: number, fresh: boolean) => {
		const updated = ingredients.map(ing => (ing.id === id ? { ...ing, fresh } : ing));
		onIngredientsChange(updated);
	};

	const handleAddIngredient = () => {
		const newId = Math.max(...ingredients.map(i => i.id), 0) + 1;
		const newIngredient: ExtendedRecipeIngredient = {
			id: newId,
			quantity: '1',
			quantity4: '1',
			ingredient: {
				id: 0, // Use 0 to indicate this is a new ingredient
				name: '',
				pantryCategory: {
					id: 1,
					name: 'Unknown',
				},
			},
			// Mark as manually added (show name field, hide metadata fields)
			manually_added: true,
		};
		onIngredientsChange([...ingredients, newIngredient]);
	};

	return (
		<div className="bg-white border border-custom rounded-sm shadow-md">
			<div className="p-4 border-b border-custom">
				<h2 className="text-lg font-semibold text-foreground">Ingredients</h2>
				<p className="text-sm text-muted mt-1">Edit ingredients as needed. All changes will be saved when you confirm the import.</p>
			</div>
			<div className="p-4">
				<div className="overflow-visible">
					<table className="w-full">
						<thead>
							<tr className="border-b border-light">
								<th className="px-2 py-3 text-left text-sm font-medium">Ingredient Name</th>
								<th className="px-1 py-3 text-center text-sm font-medium w-24">2p Qty</th>
								<th className="px-1 py-3 text-center text-sm font-medium w-24">4p Qty</th>
								<th className="px-1 py-3 text-center text-sm font-medium w-24">Measure</th>
								<th className="px-1 py-3 text-center text-sm font-medium w-20">Buy Fresh?</th>
								<th className="px-1 py-3 text-center text-sm font-medium w-32">Pantry Cat.</th>
								<th className="px-1 py-3 text-center text-sm font-medium w-32">Store Cat.</th>
								<th className="px-1 py-3 text-center text-sm font-medium w-20">Actions</th>
							</tr>
						</thead>
						<tbody>
							{ingredients.map(ingredient => (
								<tr key={ingredient.id} className="border-b border-light">
									<td className="p-0">
										<div className="flex items-stretch h-full">
											{ingredient.ingredient.pantryCategory?.name && (
												<div className="flex items-center relative group">
													<div
														className="block w-1 h-full min-h-10"
														style={{
															cursor: 'pointer',
															backgroundColor: getPantryCategoryColor(ingredient.ingredient.pantryCategory.name, true),
														}}
													></div>
													<Tooltip
														text={ingredient.ingredient.pantryCategory.name}
														backgroundColor={getPantryCategoryColor(ingredient.ingredient.pantryCategory.name, false)}
													/>
												</div>
											)}
											<div className="flex items-center px-2 py-2 flex-1">
												{ingredient.existing_ingredient_id && !ingredient.manually_added ? (
													<div className="w-full px-2 py-1 text-sm text-gray-900 dark:text-gray-100">{ingredient.ingredient.name}</div>
												) : (
													<input
														type="text"
														value={ingredient.ingredient.name}
														onChange={e => handleIngredientNameChange(ingredient.id, e.target.value)}
														className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
														placeholder="Ingredient name"
														list="preview-ingredients"
													/>
												)}
											</div>
										</div>
									</td>
									<td className="px-2 py-2 text-center">
										<input
											type="text"
											value={ingredient.quantity}
											onChange={e => handleQuantityChange(ingredient.id, 'quantity', e.target.value)}
											className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
											placeholder="qty"
										/>
									</td>
									<td className="px-2 py-2 text-center">
										<input
											type="text"
											value={ingredient.quantity4}
											onChange={e => handleQuantityChange(ingredient.id, 'quantity4', e.target.value)}
											className="w-full px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
											placeholder="qty"
										/>
									</td>
									<td className="px-2 py-2 text-center">
										<select
											value={ingredient.measure?.id || ''}
											onChange={e => handleMeasureChange(ingredient.id, e.target.value)}
											className="w-full px-1 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
										>
											<option value="">-</option>
											{options?.measures.map(measure => (
												<option key={measure.id} value={measure.id}>
													{measure.name}
												</option>
											))}
										</select>
									</td>
									{/* Fresh checkbox - only show for AI-detected new ingredients */}
									<td className="px-2 py-2 text-center">
										{ingredient.existing_ingredient_id || ingredient.manually_added ? (
											<span className="text-xs text-gray-500"></span>
										) : (
											<input
												type="checkbox"
												checked={ingredient.fresh || false}
												onChange={e => handleFreshChange(ingredient.id, e.target.checked)}
												className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
											/>
										)}
									</td>
									{/* Pantry Category dropdown - only show for AI-detected new ingredients */}
									<td className="px-2 py-2 text-center">
										{ingredient.existing_ingredient_id || ingredient.manually_added ? (
											<span className="text-xs text-gray-500"></span>
										) : (
											<select
												value={ingredient.pantryCategory_id || ''}
												onChange={e => handleCategoryChange(ingredient.id, 'pantryCategory_id', parseInt(e.target.value))}
												className="w-full px-1 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
											>
												<option value="">Select...</option>
												{categories?.pantryCategories.map(category => (
													<option key={category.id} value={category.id}>
														{category.name}
													</option>
												))}
											</select>
										)}
									</td>
									{/* Supermarket Category dropdown - only show for AI-detected new ingredients */}
									<td className="px-2 py-2 text-center">
										{ingredient.existing_ingredient_id || ingredient.manually_added ? (
											<span className="text-xs text-gray-500"></span>
										) : (
											<select
												value={ingredient.supermarketCategory_id || ''}
												onChange={e => handleCategoryChange(ingredient.id, 'supermarketCategory_id', parseInt(e.target.value))}
												className="w-full px-1 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
											>
												<option value="">Select...</option>
												{categories?.supermarketCategories.map(category => (
													<option key={category.id} value={category.id}>
														{category.name}
													</option>
												))}
											</select>
										)}
									</td>
									<td className="px-2 py-2 text-center">
										<button
											onClick={() => handleDeleteIngredient(ingredient.id)}
											className="p-1 text-red-600 hover:text-red-800 transition-colors"
											title="Remove ingredient"
										>
											<TrashIcon className="w-4 h-4" />
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Add ingredient button */}
				<div className="mt-4 text-center">
					<button
						type="button"
						onClick={handleAddIngredient}
						className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm mx-auto"
					>
						<PlusIcon className="w-4 h-4" />
						Add Ingredient
					</button>
				</div>

				{/* Datalist for ingredient autocomplete */}
				<datalist id="preview-ingredients">
					{options?.ingredients.map(ing => (
						<option key={ing.id} value={ing.name} />
					))}
				</datalist>
			</div>
		</div>
	);
};

export default IngredientsPreviewTable;
