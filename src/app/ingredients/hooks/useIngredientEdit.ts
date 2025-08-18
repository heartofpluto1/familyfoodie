import { useState } from 'react';
import { IngredientData, CategoryData } from '../page';
import { ingredientService, UpdateIngredientRequest } from '../services/ingredientService';
import { useToast } from '@/app/components/ToastProvider';

interface EditingIngredient extends IngredientData {
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

export const useIngredientEdit = (supermarketCategories: CategoryData[], pantryCategories: CategoryData[]) => {
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editingData, setEditingData] = useState<EditingIngredient | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const { showToast } = useToast();

	const getCategoryId = (categoryName: string | null, categories: CategoryData[]): number | null => {
		if (!categoryName) return null;
		const category = categories.find(cat => cat.name === categoryName);
		return category?.id || null;
	};

	const handleEdit = (ingredient: IngredientData) => {
		setEditingId(ingredient.id);
		setEditingData({
			...ingredient,
			supermarketCategoryId: getCategoryId(ingredient.supermarketCategory, supermarketCategories),
			pantryCategoryId: getCategoryId(ingredient.pantryCategory, pantryCategories),
		});
	};

	const handleSave = async () => {
		if (!editingData) return;

		setIsLoading(true);
		try {
			const updateData: UpdateIngredientRequest = {
				id: editingData.id,
				name: editingData.name,
				fresh: editingData.fresh,
				price: editingData.price,
				stockcode: editingData.stockcode,
				supermarketCategoryId: editingData.supermarketCategoryId,
				pantryCategoryId: editingData.pantryCategoryId,
			};

			await ingredientService.updateIngredient(updateData);
			showToast('success', 'Success', 'Ingredient updated successfully');
			setEditingId(null);
			setEditingData(null);
			window.location.reload();
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to update ingredient');
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		setEditingId(null);
		setEditingData(null);
	};

	const handleDelete = async (id: number) => {
		if (!confirm('Are you sure you want to delete this ingredient? This action cannot be undone.')) {
			return;
		}

		setIsLoading(true);
		try {
			await ingredientService.deleteIngredient(id);
			showToast('success', 'Success', 'Ingredient deleted successfully');
			window.location.reload();
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to delete ingredient');
		} finally {
			setIsLoading(false);
		}
	};

	return {
		editingId,
		editingData,
		isLoading,
		setEditingData,
		handleEdit,
		handleSave,
		handleCancel,
		handleDelete,
	};
};
