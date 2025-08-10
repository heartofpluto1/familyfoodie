import { useState } from 'react';
import { Ingredient } from '@/types/shop';

export function useAddItem(allIngredients: Ingredient[]) {
	const [addItemValue, setAddItemValue] = useState<string>('');
	const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);

	const handleInputChange = (value: string) => {
		setAddItemValue(value);

		// Check if the new value matches an ingredient from the datalist
		const matchingIngredient = allIngredients.find(ing => ing.name === value);
		setSelectedIngredientId(matchingIngredient ? matchingIngredient.ingredientId : null);
	};

	const clearInput = () => {
		setAddItemValue('');
		setSelectedIngredientId(null);
	};

	return {
		addItemValue,
		selectedIngredientId,
		handleInputChange,
		clearInput,
	};
}
