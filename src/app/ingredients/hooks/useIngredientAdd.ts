import { useState } from 'react';
import { ingredientService, AddIngredientRequest } from '../services/ingredientService';
import { useToast } from '@/app/components/ToastProvider';

interface NewIngredient {
	name: string;
	fresh: boolean;
	price: number | null;
	stockcode: number | null;
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

const initialIngredientState: NewIngredient = {
	name: '',
	fresh: false,
	price: null,
	stockcode: null,
	supermarketCategoryId: null,
	pantryCategoryId: null,
};

export const useIngredientAdd = () => {
	const [isAdding, setIsAdding] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [newIngredientData, setNewIngredientData] = useState<NewIngredient>(initialIngredientState);
	const { showToast } = useToast();

	const handleStartAdd = () => {
		setIsAdding(true);
		setNewIngredientData(initialIngredientState);
	};

	const handleAddSave = async () => {
		if (!newIngredientData.name.trim()) {
			showToast('error', 'Error', 'Ingredient name is required');
			return;
		}

		setIsLoading(true);
		try {
			const addData: AddIngredientRequest = {
				name: newIngredientData.name.trim(),
				fresh: newIngredientData.fresh,
				price: newIngredientData.price,
				stockcode: newIngredientData.stockcode,
				supermarketCategoryId: newIngredientData.supermarketCategoryId,
				pantryCategoryId: newIngredientData.pantryCategoryId,
			};

			await ingredientService.addIngredient(addData);
			showToast('success', 'Success', 'Ingredient added successfully');
			setIsAdding(false);
			setNewIngredientData(initialIngredientState);
			window.location.reload();
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to add ingredient');
		} finally {
			setIsLoading(false);
		}
	};

	const handleAddCancel = () => {
		setIsAdding(false);
		setNewIngredientData(initialIngredientState);
	};

	return {
		isAdding,
		isLoading,
		newIngredientData,
		setNewIngredientData,
		handleStartAdd,
		handleAddSave,
		handleAddCancel,
	};
};
