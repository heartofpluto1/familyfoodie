'use client';

import React from 'react';
import { IngredientData, CategoryData } from '../page';
import { CheckIcon, LinkIcon, EditIcon, SaveIcon, TrashIcon } from '@/app/components/Icons';
import { getSupermarketCategoryColor, getPantryCategoryColor } from '@/lib/utils/categoryColors';
import { formatPrice } from '@/lib/utils/formatting';

interface EditingIngredient extends IngredientData {
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

interface IngredientRowProps {
	ingredient: IngredientData;
	isEditing: boolean;
	editingData: EditingIngredient | null;
	supermarketCategories: CategoryData[];
	pantryCategories: CategoryData[];
	isLoading: boolean;
	onEdit: (ingredient: IngredientData) => void;
	onSave: () => void;
	onCancel: () => void;
	onDelete: (id: number) => void;
	onEditingDataChange: (updater: (prev: EditingIngredient | null) => EditingIngredient | null) => void;
}

export function IngredientRow({
	ingredient,
	isEditing,
	editingData,
	supermarketCategories,
	pantryCategories,
	isLoading,
	onEdit,
	onSave,
	onCancel,
	onDelete,
	onEditingDataChange,
}: IngredientRowProps) {
	const currentData = isEditing && editingData ? editingData : ingredient;

	return (
		<tr key={ingredient.id} className="border-b border-light">
			{/* Name column with category color */}
			<td className="p-0">
				<div className="flex items-stretch h-full">
					<div className="flex items-center px-2 sm:px-4 py-2 sm:py-3 flex-1">
						{isEditing && editingData ? (
							<div className="w-full space-y-1">
								<div className="flex gap-2">
									<input
										type="text"
										value={editingData.name}
										onChange={e => onEditingDataChange(prev => (prev ? { ...prev, name: e.target.value } : null))}
										className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
										title="Ingredient name"
									/>
									<select
										value={editingData.supermarketCategoryId || ''}
										onChange={e => {
											const value = e.target.value;
											const categoryId = value ? parseInt(value) : null;
											const category = supermarketCategories.find(cat => cat.id === categoryId);
											onEditingDataChange(prev =>
												prev
													? {
															...prev,
															supermarketCategoryId: categoryId,
															supermarketCategory: category?.name || null,
														}
													: null
											);
										}}
										className="flex-1 px-1 py-1 text-xs border border-gray-300 rounded"
										title="Supermarket category"
									>
										<option value="">No Supermarket Category</option>
										{supermarketCategories.map(cat => (
											<option key={cat.id} value={cat.id}>
												{cat.name}
											</option>
										))}
									</select>
									<select
										value={editingData.pantryCategoryId || ''}
										onChange={e => {
											const value = e.target.value;
											const categoryId = value ? parseInt(value) : null;
											const category = pantryCategories.find(cat => cat.id === categoryId);
											onEditingDataChange(prev =>
												prev
													? {
															...prev,
															pantryCategoryId: categoryId,
															pantryCategory: category?.name || null,
														}
													: null
											);
										}}
										className="flex-1 px-1 py-1 text-xs border border-gray-300 rounded"
										title="Pantry category"
									>
										<option value="">No Pantry Category</option>
										{pantryCategories.map(cat => (
											<option key={cat.id} value={cat.id}>
												{cat.name}
											</option>
										))}
									</select>
								</div>
							</div>
						) : (
							<span className="text-xs sm:text-sm">{currentData.name}</span>
						)}
					</div>
				</div>
			</td>

			{/* Shop and pantry category column */}
			<td className="px-1 sm:px-2 py-2 sm:py-3 text-center">
				{currentData.supermarketCategory ? (
					<span
						className="inline-flex items-center justify-center mx-1 px-2 py-0.5 text-xs font-medium text-white rounded-full"
						style={{ backgroundColor: getSupermarketCategoryColor(currentData.supermarketCategory, true) }}
					>
						{currentData.supermarketCategory}
					</span>
				) : (
					<span className="text-gray-400 dark:text-gray-500">-</span>
				)}

				{currentData.pantryCategory ? (
					<span
						className="inline-flex items-center justify-center mx-1 px-2 py-0.5 text-xs font-medium rounded-full"
						style={{
							backgroundColor: getPantryCategoryColor(currentData.pantryCategory, true),
							color: currentData.pantryCategory === 'other' || currentData.pantryCategory === 'breezeway-cupboard' ? '#333' : '#fff',
						}}
					>
						{currentData.pantryCategory}
					</span>
				) : (
					<span className="text-gray-400 dark:text-gray-500">-</span>
				)}
			</td>

			{/* Fresh column */}
			<td className="px-1 sm:px-2 py-2 sm:py-3 text-center">
				{isEditing && editingData ? (
					<input
						type="checkbox"
						checked={editingData.fresh}
						onChange={e => onEditingDataChange(prev => (prev ? { ...prev, fresh: e.target.checked } : null))}
						className="h-4 w-4"
					/>
				) : currentData.fresh ? (
					<CheckIcon className="w-4 h-4 mx-auto text-green-600" />
				) : (
					''
				)}
			</td>

			{/* Recipes column */}
			<td className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm">
				{ingredient.recipeCount > 0 ? (
					<span className="inline-flex items-center justify-center min-w-[1.5rem] px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-medium">
						{ingredient.recipeCount}
					</span>
				) : (
					<span className="text-gray-400 dark:text-gray-500">-</span>
				)}
			</td>

			{/* Price column */}
			<td className="px-1 sm:px-2 py-2 sm:py-3 text-right text-xs sm:text-sm">
				{isEditing && editingData ? (
					<input
						type="number"
						step="0.01"
						value={editingData.price || ''}
						onChange={e => {
							const value = e.target.value;
							onEditingDataChange(prev =>
								prev
									? {
											...prev,
											price: value ? parseFloat(value) : null,
										}
									: null
							);
						}}
						className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-right"
					/>
				) : (
					currentData.price && formatPrice(currentData.price)
				)}
			</td>

			{/* Stockcode column */}
			<td className="px-1 sm:px-2 py-2 sm:py-3 text-right text-xs sm:text-sm">
				{isEditing && editingData ? (
					<input
						type="text"
						value={editingData.stockcode || ''}
						onChange={e => {
							const value = e.target.value;
							onEditingDataChange(prev =>
								prev
									? {
											...prev,
											stockcode: value ? parseInt(value) : null,
										}
									: null
							);
						}}
						className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-right"
					/>
				) : currentData.stockcode ? (
					<div className="flex items-center justify-end gap-1">
						<span>{currentData.stockcode}</span>
						<a
							href={`https://www.woolworths.com.au/shop/productdetails/${currentData.stockcode}/`}
							target="_blank"
							rel="noopener noreferrer"
							title="Woolworths details"
							className="flex items-center transition-colors"
						>
							<LinkIcon className="w-4 h-4" />
						</a>
					</div>
				) : (
					''
				)}
			</td>

			{/* Edit/Save column */}
			<td className="px-1 sm:px-2 py-2 sm:py-3 text-center">
				{isEditing && editingData ? (
					<div className="flex items-center justify-center gap-1">
						<button
							onClick={onSave}
							disabled={isLoading}
							className="flex items-center p-1 text-foreground hover:text-secondary transition-colors disabled:opacity-50"
							title="Save"
						>
							<SaveIcon className="w-4 h-4" />
						</button>
						<button onClick={() => onDelete(ingredient.id)} disabled={isLoading} className="p-1 disabled:opacity-50" title="Delete">
							<TrashIcon className="w-4 h-4" />
						</button>
						<button onClick={onCancel} disabled={isLoading} className="p-1 text-gray-600 hover:text-gray-800 disabled:opacity-50" title="Cancel">
							×
						</button>
					</div>
				) : (
					<button onClick={() => onEdit(ingredient)} className="flex items-center p-1 text-foreground hover:text-secondary transition-colors" title="Edit">
						<EditIcon className="w-4 h-4" />
					</button>
				)}
			</td>
		</tr>
	);
}
