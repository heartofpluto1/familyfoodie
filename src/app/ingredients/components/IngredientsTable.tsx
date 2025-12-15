'use client';

import React from 'react';
import { IngredientData, CategoryData } from '../page';
import { AddIngredientForm } from './AddIngredientForm';
import { IngredientRow } from './IngredientRow';
import { useIngredientEdit } from '../hooks/useIngredientEdit';
import { useTableSort, SortColumn } from '../hooks/useTableSort';
import { ChevronUpIcon, ChevronDownIcon } from '@/app/components/Icons';
import ConfirmDialog from '@/app/components/ConfirmDialog';

interface IngredientsTableProps {
	ingredients: IngredientData[];
	supermarketCategories: CategoryData[];
	pantryCategories: CategoryData[];
}

interface SortableHeaderProps {
	column: SortColumn;
	children: React.ReactNode;
	align?: 'left' | 'center' | 'right';
	sortConfig: { column: SortColumn; direction: 'asc' | 'desc' };
	onSort: (column: SortColumn) => void;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({ column, children, align = 'left', sortConfig, onSort }) => {
	const isActive = sortConfig.column === column;
	return (
		<button
			className={`flex items-center gap-1 w-full hover:text-secondary transition-colors ${
				align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
			}`}
			onClick={() => onSort(column)}
		>
			<span className="select-none">{children}</span>
			{isActive && (
				<span className="inline-flex">
					{sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
				</span>
			)}
		</button>
	);
};

export function IngredientsTable({ ingredients, supermarketCategories, pantryCategories }: IngredientsTableProps) {
	const {
		editingId,
		editingData,
		isLoading,
		setEditingData,
		handleEdit,
		handleSave,
		handleCancel,
		handleDeleteClick,
		handleDeleteConfirm,
		handleDeleteCancel,
		showDeleteConfirm,
		isDeleting,
	} = useIngredientEdit(supermarketCategories, pantryCategories);

	const { sortedIngredients, sortConfig, handleSort } = useTableSort(ingredients);

	return (
		<div className="overflow-visible">
			<AddIngredientForm supermarketCategories={supermarketCategories} pantryCategories={pantryCategories} />

			<table className="w-full">
				<thead>
					<tr className="border-b border-light">
						<th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium">
							<SortableHeader column="name" sortConfig={sortConfig} onSort={handleSort}>
								Name
							</SortableHeader>
						</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium w-50 sm:w-50">
							<SortableHeader column="supermarketCategory" align="center" sortConfig={sortConfig} onSort={handleSort}>
								<span>
									Location <br />
									shops and home
								</span>
							</SortableHeader>
						</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium w-30 sm:w-30">
							<SortableHeader column="fresh" align="center" sortConfig={sortConfig} onSort={handleSort}>
								<span>
									Always
									<br />
									buy fresh
								</span>
							</SortableHeader>
						</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium w-30 sm:w-30">
							<SortableHeader column="recipeCount" align="center" sortConfig={sortConfig} onSort={handleSort}>
								<span>
									Featured in <br />
									no. recipes
								</span>
							</SortableHeader>
						</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium w-24 sm:w-24">
							<SortableHeader column="price" align="right" sortConfig={sortConfig} onSort={handleSort}>
								Default cost
							</SortableHeader>
						</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium w-28 sm:w-28">
							<SortableHeader column="stockcode" align="right" sortConfig={sortConfig} onSort={handleSort}>
								Stockcode
							</SortableHeader>
						</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium w-16 sm:w-16">Edit</th>
					</tr>
				</thead>
				<tbody>
					{sortedIngredients.map(ingredient => (
						<IngredientRow
							key={ingredient.id}
							ingredient={ingredient}
							isEditing={editingId === ingredient.id}
							editingData={editingData}
							supermarketCategories={supermarketCategories}
							pantryCategories={pantryCategories}
							isLoading={isLoading}
							onEdit={handleEdit}
							onSave={handleSave}
							onCancel={handleCancel}
							onDelete={handleDeleteClick}
							onEditingDataChange={setEditingData}
						/>
					))}
				</tbody>
			</table>

			{/* Delete Ingredient Confirmation Dialog */}
			<ConfirmDialog
				isOpen={showDeleteConfirm}
				title="Delete Ingredient"
				message="Are you sure you want to delete this ingredient? This action cannot be undone."
				confirmText="Delete Ingredient"
				cancelText="Cancel"
				onConfirm={handleDeleteConfirm}
				onCancel={handleDeleteCancel}
				isLoading={isDeleting}
			/>
		</div>
	);
}
