import { useToast } from '@/app/components/ToastProvider';

interface RecipeData {
	name: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	seasonId?: number;
	primaryTypeId?: number;
	secondaryTypeId?: number;
}

export const useRecipeApi = () => {
	const { showToast } = useToast();

	const updateRecipe = async (id: number, data: RecipeData): Promise<boolean> => {
		try {
			const response = await fetch('/api/recipe/update', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, ...data }),
			});

			if (response.ok) {
				showToast('success', 'Success', 'Recipe updated successfully');
				return true;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to update recipe');
				return false;
			}
		} catch (error) {
			console.error('Error updating recipe:', error);
			showToast('error', 'Error', 'Error updating recipe');
			return false;
		}
	};

	const uploadImage = async (recipeId: number, file: File): Promise<boolean> => {
		try {
			const formData = new FormData();
			formData.append('image', file);
			formData.append('recipeId', recipeId.toString());

			const response = await fetch('/api/recipe/upload-image', {
				method: 'POST',
				body: formData,
			});

			if (response.ok) {
				showToast('success', 'Success', 'Image uploaded successfully');
				return true;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to upload image');
				return false;
			}
		} catch (error) {
			console.error('Error uploading image:', error);
			showToast('error', 'Error', 'Error uploading image');
			return false;
		}
	};

	const uploadPdf = async (recipeId: number, file: File): Promise<boolean> => {
		try {
			const formData = new FormData();
			formData.append('pdf', file);
			formData.append('recipeId', recipeId.toString());

			const response = await fetch('/api/recipe/upload-pdf', {
				method: 'POST',
				body: formData,
			});

			if (response.ok) {
				showToast('success', 'Success', 'PDF uploaded successfully');
				return true;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to upload PDF');
				return false;
			}
		} catch (error) {
			console.error('Error uploading PDF:', error);
			showToast('error', 'Error', 'Error uploading PDF');
			return false;
		}
	};

	const deleteRecipe = async (recipeId: number): Promise<boolean> => {
		try {
			const response = await fetch('/api/recipe/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ recipeId }),
			});

			if (response.ok) {
				const result = await response.json();

				// Show appropriate success message based on whether recipe was archived or deleted
				if (result.archived) {
					showToast('info', 'Recipe Archived', result.message);
				} else {
					// Recipe was deleted - show details about ingredient cleanup if any
					const title = result.deletedIngredientsCount > 0 ? 'Recipe Deleted & Cleaned Up' : 'Recipe Deleted';
					showToast('success', title, result.message);
				}
				return true;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to delete recipe');
				return false;
			}
		} catch (error) {
			console.error('Error deleting recipe:', error);
			showToast('error', 'Error', 'Error deleting recipe');
			return false;
		}
	};

	return {
		updateRecipe,
		uploadImage,
		uploadPdf,
		deleteRecipe,
	};
};
