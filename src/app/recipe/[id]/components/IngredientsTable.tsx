'use client';

import { RecipeIngredient } from '@/types/menus';
import { SaveIcon, TrashIcon, PlusIcon } from '@/app/components/Icons';
import Tooltip from '@/app/components/Tooltip';
import { getPantryCategoryColor } from '@/lib/utils/categoryColors';

interface RecipeOptions {
	seasons: { id: number; name: string }[];
	primaryTypes: { id: number; name: string }[];
	secondaryTypes: { id: number; name: string }[];
	ingredients: {
		id: number;
		name: string;
		pantryCategory_id: number;
		pantryCategory_name: string;
	}[];
	measures: { id: number; name: string }[];
	preparations: { id: number; name: string }[];
}

interface NewIngredient {
	ingredientName: string;
	quantity: string;
	quantity4: string;
	measureId: string;
	preparationId: string;
}

interface IngredientsTableProps {
	ingredients: RecipeIngredient[];
	isEditing: boolean;
	options: RecipeOptions | null;
	newIngredients: NewIngredient[];
	onNewIngredientsChange: (ingredients: NewIngredient[]) => void;
	onDeleteIngredient: (id: number) => void;
	onAddIngredient: (index: number) => void;
	onRemoveNewIngredient: (index: number) => void;
	onAddNewIngredientRow: () => void;
}

const IngredientsTable = ({
	ingredients,
	isEditing,
	options,
	newIngredients,
	onNewIngredientsChange,
	onDeleteIngredient,
	onAddIngredient,
	onRemoveNewIngredient,
	onAddNewIngredientRow,
}: IngredientsTableProps) => {
	return (
		<div className="bg-white border border-custom rounded-sm shadow-md overflow-hidden">
			<div className="overflow-visible">
				<table className="w-full">
					<thead>
						<tr className="border-b border-light">
							<th className="px-2 py-3 text-left text-sm font-medium">Ingredients</th>
							<th className="px-1 py-3 text-center text-sm font-medium w-25">2p</th>
							<th className="px-1 py-3 text-center text-sm font-medium w-25">4p</th>
							{isEditing && <th className="px-1 py-3 text-center text-sm font-medium w-20">Actions</th>}
						</tr>
					</thead>
					<tbody>
						{ingredients.map((ingredient, index) => (
							<tr key={`ingredient-${ingredient.id}-${ingredient.ingredient.id}-${index}`} className="border-b border-light">
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
											<span className="text-sm">
												{ingredient.ingredient.name}
												{ingredient.preperation && <span className="text-muted ml-1">({ingredient.preperation.name})</span>}
											</span>
										</div>
									</div>
								</td>
								<td className="px-2 py-2 text-center text-sm">{`${ingredient.quantity}${ingredient.measure ? ` ${ingredient.measure.name}` : ''}`}</td>
								<td className="px-2 py-2 text-center text-sm">{`${ingredient.quantity4}${ingredient.measure ? ` ${ingredient.measure.name}` : ''}`}</td>
								{isEditing && (
									<td className="px-2 py-2 text-center">
										<button onClick={() => onDeleteIngredient(ingredient.id)} className="p-1 transition-colors" title="Remove ingredient">
											<TrashIcon className="w-4 h-4" />
										</button>
									</td>
								)}
							</tr>
						))}

						{/* Add new ingredient rows */}
						{isEditing &&
							options &&
							newIngredients.map((newIngredient, index) => (
								<tr key={`new-${index}`} className="border-b border-light bg-gray-50">
									<td className="px-2 py-2">
										<input
											type="text"
											list={`ingredients-datalist-${index}`}
											value={newIngredient.ingredientName}
											onChange={e => {
												const updated = [...newIngredients];
												updated[index] = { ...updated[index], ingredientName: e.target.value };
												onNewIngredientsChange(updated);
											}}
											placeholder="Type to search ingredients..."
											className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
										/>
										<datalist id={`ingredients-datalist-${index}`}>
											{options.ingredients.map(ing => (
												<option key={ing.id} value={ing.name} />
											))}
										</datalist>
									</td>
									<td className="px-2 py-2">
										<input
											type="text"
											value={newIngredient.quantity}
											onChange={e => {
												const updated = [...newIngredients];
												updated[index] = { ...updated[index], quantity: e.target.value };
												onNewIngredientsChange(updated);
											}}
											placeholder="2p qty"
											className="w-full px-1 py-1 text-center border border-gray-300 rounded text-xs"
										/>
									</td>
									<td className="px-2 py-2">
										<input
											type="text"
											value={newIngredient.quantity4}
											onChange={e => {
												const updated = [...newIngredients];
												updated[index] = { ...updated[index], quantity4: e.target.value };
												onNewIngredientsChange(updated);
											}}
											placeholder="4p qty"
											className="w-full px-1 py-1 text-center border border-gray-300 rounded text-xs"
										/>
									</td>
									<td className="px-2 py-2 text-center">
										<div className="flex gap-1 justify-center">
											<select
												value={newIngredient.measureId}
												onChange={e => {
													const updated = [...newIngredients];
													updated[index] = { ...updated[index], measureId: e.target.value };
													onNewIngredientsChange(updated);
												}}
												className="w-20 px-1 py-1 text-center border border-gray-300 rounded text-xs mr-1"
											>
												<option value="">Unit</option>
												{options.measures.map(measure => (
													<option key={measure.id} value={measure.id}>
														{measure.name}
													</option>
												))}
											</select>
											<button
												type="button"
												onClick={() => onAddIngredient(index)}
												disabled={!newIngredient.ingredientName || !newIngredient.quantity || !newIngredient.quantity4}
												className="p-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
												title="Add ingredient"
											>
												<SaveIcon className="w-4 h-4" />
											</button>
											{newIngredients.length > 1 && (
												<button type="button" onClick={() => onRemoveNewIngredient(index)} className="p-1 transition-colors" title="Remove row">
													<TrashIcon className="w-4 h-4" />
												</button>
											)}
										</div>
									</td>
								</tr>
							))}

						{/* Add new row button */}
						{isEditing && options && (
							<tr>
								<td colSpan={4} className="px-2 py-2 text-center">
									<button
										type="button"
										onClick={onAddNewIngredientRow}
										className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-xs mx-auto"
										title="Add another ingredient row"
									>
										<PlusIcon className="w-3 h-3" />
										Add Row
									</button>
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default IngredientsTable;
