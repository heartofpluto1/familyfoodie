import { useState } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import { RecipeIngredient } from '@/types/menus';

interface IngredientData {
	recipeId: number;
	ingredientId: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
	preparationId?: number;
}

interface UpdateIngredientData {
	id: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
}

interface RecipeOptions {
	preparations?: {
		id: number;
		name: string;
	}[];
}

export const useIngredientApi = () => {
	const { showToast } = useToast();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [ingredientToDelete, setIngredientToDelete] = useState<number | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const addIngredient = async (data: IngredientData): Promise<number | null> => {
		try {
			const response = await fetch('/api/recipe/ingredients', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...data,
					primaryIngredient: 0, // Default value as per backend requirement
				}),
			});

			if (response.ok) {
				const result = await response.json();
				showToast('success', 'Success', 'Ingredient added');
				return result.id;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to add ingredient');
				return null;
			}
		} catch (error) {
			console.error('Error adding ingredient:', error);
			showToast('error', 'Error', 'Error adding ingredient');
			return null;
		}
	};

	const updateIngredient = async (data: UpdateIngredientData): Promise<boolean> => {
		try {
			const response = await fetch('/api/recipe/ingredients', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			});

			if (response.ok) {
				showToast('success', 'Success', 'Ingredient updated');
				return true;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to update ingredient');
				return false;
			}
		} catch (error) {
			console.error('Error updating ingredient:', error);
			showToast('error', 'Error', 'Error updating ingredient');
			return false;
		}
	};

	const deleteIngredientClick = (id: number) => {
		setIngredientToDelete(id);
		setShowDeleteConfirm(true);
	};

	const deleteIngredientConfirm = async (): Promise<boolean> => {
		if (!ingredientToDelete) return false;

		setIsDeleting(true);
		try {
			const response = await fetch(`/api/recipe/ingredients?id=${ingredientToDelete}`, {
				method: 'DELETE',
			});

			if (response.ok) {
				showToast('success', 'Success', 'Ingredient removed');
				setShowDeleteConfirm(false);
				setIngredientToDelete(null);
				return true;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to remove ingredient');
				return false;
			}
		} catch (error) {
			console.error('Error removing ingredient:', error);
			showToast('error', 'Error', 'Error removing ingredient');
			return false;
		} finally {
			setIsDeleting(false);
		}
	};

	const deleteIngredientCancel = () => {
		setShowDeleteConfirm(false);
		setIngredientToDelete(null);
	};

	const addMultipleIngredients = async (recipeId: number, ingredients: RecipeIngredient[], options?: RecipeOptions): Promise<boolean> => {
		let allSuccess = true;

		for (const ingredient of ingredients) {
			try {
				// Find preparation ID if we have options and preparation name
				let preparationId: number | undefined;
				if (options?.preparations && ingredient.preperation?.name) {
					const prep = options.preparations.find(p => p.name === ingredient.preperation?.name);
					preparationId = prep?.id;
				}

				const response = await fetch('/api/recipe/ingredients', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						recipeId,
						ingredientId: ingredient.ingredient.id,
						quantity: ingredient.quantity,
						quantity4: ingredient.quantity4,
						measureId: ingredient.measure?.id,
						preparationId,
						primaryIngredient: 0,
					}),
				});

				if (!response.ok) {
					allSuccess = false;
					console.error('Failed to add ingredient:', ingredient);
				}
			} catch (error) {
				console.error('Error adding ingredient:', error);
				allSuccess = false;
			}
		}

		if (allSuccess) {
			showToast('success', 'Success', 'All ingredients added successfully');
		} else {
			showToast('warning', 'Warning', 'Some ingredients may not have been added');
		}

		return allSuccess;
	};

	return {
		addIngredient,
		updateIngredient,
		deleteIngredientClick,
		deleteIngredientConfirm,
		deleteIngredientCancel,
		addMultipleIngredients,
		// Confirmation state
		showDeleteConfirm,
		isDeleting,
	};
};
