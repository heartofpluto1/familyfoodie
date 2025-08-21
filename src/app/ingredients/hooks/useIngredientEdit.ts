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
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [ingredientToDelete, setIngredientToDelete] = useState<number | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
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

	const handleDeleteClick = (id: number) => {
		setIngredientToDelete(id);
		setShowDeleteConfirm(true);
	};

	const handleDeleteConfirm = async () => {
		if (!ingredientToDelete) return;

		setIsDeleting(true);
		try {
			await ingredientService.deleteIngredient(ingredientToDelete);
			showToast('success', 'Success', 'Ingredient deleted successfully');
			setShowDeleteConfirm(false);
			setIngredientToDelete(null);
			window.location.reload();
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to delete ingredient');
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDeleteCancel = () => {
		setShowDeleteConfirm(false);
		setIngredientToDelete(null);
	};

	return {
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
		// Confirmation state
		showDeleteConfirm,
		isDeleting,
	};
};
