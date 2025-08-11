import React from 'react';
import { Ingredient } from '@/types/shop';

interface AddItemInputProps {
	value: string;
	onChange: (value: string) => void;
	onAddItem: () => void;
	allIngredients: Ingredient[];
}

export function AddItemInput({ value, onChange, onAddItem, allIngredients }: AddItemInputProps) {
	return (
		<div className="p-2 sm:p-4 bg-gray-50">
			<input
				type="text"
				value={value}
				onChange={e => onChange(e.target.value)}
				onKeyDown={e => {
					if (e.key === 'Enter') {
						e.preventDefault();
						onAddItem();
					}
				}}
				className="w-full px-2 py-1.5 sm:py-2 rounded-sm text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="add item..."
				list="all-ingredients"
			/>
			<datalist id="all-ingredients">
				{allIngredients.map(ing => (
					<option key={ing.ingredientId} value={ing.name} />
				))}
			</datalist>
		</div>
	);
}
