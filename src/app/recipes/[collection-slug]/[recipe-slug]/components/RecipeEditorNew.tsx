'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeDetail, RecipeIngredient } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import { SaveIcon, EditIcon, TrashIcon, CancelIcon } from '@/app/components/Icons';
import { useToast } from '@/app/components/ToastProvider';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import ImageUploadWithCrop from './ImageUploadWithCrop';
import PdfUpload from './PdfUpload';
import RecipeForm from '@/app/recipe/components/RecipeForm';
import RecipeView from './RecipeView';
import IngredientsTable from './IngredientsTable';
import { useRecipeOptions } from '@/app/recipe/hooks/useRecipeOptions';
import { RecipeFormData, NewIngredient } from '@/app/recipe/types';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';

interface RecipeEditorProps {
	recipe: RecipeDetail;
	collections?: Collection[];
}

type EditMode = 'none' | 'image' | 'details' | 'ingredients';

const RecipeEditorNew = ({ recipe, collections }: RecipeEditorProps) => {
	const router = useRouter();
	const { showToast } = useToast();
	const { options } = useRecipeOptions();

	// Separate edit modes
	const [editMode, setEditMode] = useState<EditMode>('none');
	const [isLoading, setIsLoading] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	// Form data for details
	const [recipeForm, setRecipeForm] = useState<RecipeFormData>({
		name: recipe?.name || '',
		description: recipe?.description || '',
		prepTime: recipe?.prepTime,
		cookTime: recipe?.cookTime,
		seasonId: undefined,
		primaryTypeId: undefined,
		secondaryTypeId: undefined,
		collectionId: recipe?.collection_id,
	});

	// Ingredients state
	const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
	const [deletedIngredientIds, setDeletedIngredientIds] = useState<number[]>([]);
	const [newIngredients, setNewIngredients] = useState<NewIngredient[]>([
		{
			ingredientName: '',
			quantity: '',
			quantity4: '',
			measureId: '',
			preparationId: '',
		},
	]);

	// Set current values for dropdowns when options load
	useEffect(() => {
		if (options && recipe) {
			const currentSeason = options.seasons.find(s => s.name === recipe.seasonName);
			const currentPrimary = options.primaryTypes.find(p => p.name === recipe.primaryTypeName);
			const currentSecondary = options.secondaryTypes.find(s => s.name === recipe.secondaryTypeName);

			setRecipeForm(prev => ({
				...prev,
				seasonId: currentSeason?.id,
				primaryTypeId: currentPrimary?.id,
				secondaryTypeId: currentSecondary?.id,
			}));
		}
	}, [options, recipe]);

	// Initialize ingredients from recipe
	useEffect(() => {
		if (recipe) {
			setIngredients(recipe.ingredients);
		}
	}, [recipe]);

	// Handle edit mode changes
	const startEdit = (mode: EditMode) => {
		// Cancel any current edit before starting new one
		if (editMode !== 'none' && editMode !== mode) {
			handleCancel();
		}
		setEditMode(mode);
	};

	const handleCancel = () => {
		// Reset form data to original recipe values
		setRecipeForm({
			name: recipe?.name || '',
			description: recipe?.description || '',
			prepTime: recipe?.prepTime,
			cookTime: recipe?.cookTime,
			seasonId: undefined,
			primaryTypeId: undefined,
			secondaryTypeId: undefined,
			collectionId: recipe?.collection_id,
		});

		// Reset ingredients
		setIngredients(recipe.ingredients);
		setDeletedIngredientIds([]);
		setNewIngredients([
			{
				ingredientName: '',
				quantity: '',
				quantity4: '',
				measureId: '',
				preparationId: '',
			},
		]);

		setEditMode('none');
	};

	// Save handlers for each edit mode
	const handleSaveDetails = async () => {
		if (!recipeForm.name.trim() || !recipeForm.description.trim()) {
			showToast('error', 'Error', 'Recipe name and description are required');
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch('/api/recipe/update-details', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					id: recipe.id,
					...recipeForm,
				}),
			});

			if (response.ok) {
				showToast('success', 'Success', 'Recipe details updated successfully');
				setEditMode('none');
				// Refresh the page to show updated data
				window.location.reload();
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to update recipe details');
			}
		} catch (error) {
			console.error('Error saving recipe details:', error);
			showToast('error', 'Error', 'Failed to update recipe details');
		} finally {
			setIsLoading(false);
		}
	};

	const handleSaveIngredients = async () => {
		setIsLoading(true);
		try {
			// Prepare ingredients data
			const ingredientsData = ingredients.map(ing => ({
				id: ing.id,
				ingredientId: ing.ingredient.id,
				quantity: ing.quantity,
				quantity4: ing.quantity4,
				measureId: ing.measure?.id,
				preparationId: undefined, // preperation doesn't have an id in the type
			}));

			const response = await fetch('/api/recipe/update-ingredients', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					recipeId: recipe.id,
					ingredients: ingredientsData,
					deletedIngredientIds,
				}),
			});

			if (response.ok) {
				showToast('success', 'Success', 'Recipe ingredients updated successfully');
				setEditMode('none');
				setDeletedIngredientIds([]);
				// Refresh the page to show updated data
				window.location.reload();
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to update ingredients');
			}
		} catch (error) {
			console.error('Error saving ingredients:', error);
			showToast('error', 'Error', 'Failed to update ingredients');
		} finally {
			setIsLoading(false);
		}
	};

	const handleImageUploadComplete = () => {
		showToast('success', 'Success', 'Recipe image updated successfully');
		setEditMode('none');
		// Force refresh to show new image
		setRefreshKey(prev => prev + 1);
		// Also refresh the page after a short delay
		setTimeout(() => {
			window.location.reload();
		}, 500);
	};

	const handleDeleteIngredient = (id: number) => {
		setIngredients(prev => prev.filter(ing => ing.id !== id));
		setDeletedIngredientIds(prev => [...prev, id]);
	};

	const handleAddIngredient = async (index: number) => {
		const newIngredient = newIngredients[index];
		if (!newIngredient.ingredientName || !newIngredient.quantity || !newIngredient.quantity4) {
			showToast('error', 'Error', 'Please fill in all required fields');
			return;
		}

		if (!options) return;

		const selectedIngredient = options.ingredients.find(ing => ing.name.toLowerCase() === newIngredient.ingredientName.toLowerCase());
		const selectedMeasure = newIngredient.measureId ? options.measures.find(m => m.id === parseInt(newIngredient.measureId)) : undefined;
		const selectedPreparation = newIngredient.preparationId ? options.preparations.find(p => p.id === parseInt(newIngredient.preparationId)) : undefined;

		if (!selectedIngredient) {
			showToast('error', 'Error', 'Ingredient not found. Please select from the available options.');
			return;
		}

		// Add to local state (will be saved when user clicks save)
		const tempId = -Date.now(); // Temporary negative ID for new ingredients
		const newRecipeIngredient: RecipeIngredient = {
			id: tempId,
			quantity: newIngredient.quantity,
			quantity4: newIngredient.quantity4,
			ingredient: {
				id: selectedIngredient.id,
				name: selectedIngredient.name,
				pantryCategory: {
					id: selectedIngredient.pantryCategory_id,
					name: selectedIngredient.pantryCategory_name,
				},
			},
			measure: selectedMeasure,
			preperation: selectedPreparation,
		};

		setIngredients(prev => [...prev, newRecipeIngredient]);

		// Clear the input row
		const updated = [...newIngredients];
		updated[index] = {
			ingredientName: '',
			quantity: '',
			quantity4: '',
			measureId: '',
			preparationId: '',
		};
		setNewIngredients(updated);
	};

	const handleRemoveNewIngredient = (index: number) => {
		setNewIngredients(prev => prev.filter((_, i) => i !== index));
	};

	const handleAddNewIngredientRow = () => {
		setNewIngredients(prev => [
			...prev,
			{
				ingredientName: '',
				quantity: '',
				quantity4: '',
				measureId: '',
				preparationId: '',
			},
		]);
	};

	const handleDeleteRecipe = async () => {
		setIsLoading(true);
		try {
			const response = await fetch('/api/recipe/delete', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ id: recipe.id }),
			});

			if (response.ok) {
				showToast('success', 'Success', 'Recipe deleted successfully');
				router.push(`/recipes/${recipe.collection_url_slug || ''}`);
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to delete recipe');
			}
		} catch (error) {
			console.error('Error deleting recipe:', error);
			showToast('error', 'Error', 'Failed to delete recipe');
		} finally {
			setIsLoading(false);
			setShowDeleteConfirm(false);
		}
	};

	return (
		<div className="max-w-4xl mx-auto">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				{/* Left Column - Image and PDF */}
				<div className="space-y-4">
					{/* Recipe Image with Edit Button */}
					<div className="relative">
						{editMode === 'image' ? (
							<div className="space-y-4">
								<ImageUploadWithCrop
									recipeId={recipe.id}
									currentImageSrc={recipe ? getRecipeImageUrl(recipe.image_filename) : undefined}
									onImageUploaded={handleImageUploadComplete}
								/>
								<div className="flex gap-2">
									<button
										onClick={() => handleCancel()}
										className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
									>
										Cancel
									</button>
								</div>
							</div>
						) : (
							<div className="relative">
								<img key={refreshKey} src={getRecipeImageUrl(recipe.image_filename)} alt={recipe.name} className="w-full rounded-lg shadow-md" />
								{/* Camera edit button */}
								<button
									onClick={() => startEdit('image')}
									className="absolute bottom-4 right-4 w-10 h-10 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all flex items-center justify-center"
									title="Edit image"
								>
									<svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
										/>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								</button>
							</div>
						)}
					</div>

					{/* PDF Upload */}
					<PdfUpload recipeId={recipe.id} />
				</div>

				{/* Right Column - Recipe Details */}
				<div className="space-y-6">
					{/* Recipe Details Section with Edit Button */}
					<div className="bg-white border border-custom rounded-sm shadow-md p-4">
						<div className="flex justify-between items-start mb-4">
							<h2 className="text-xl font-semibold">Recipe Details</h2>
							{editMode === 'details' ? (
								<div className="flex gap-2">
									<button
										onClick={handleSaveDetails}
										disabled={isLoading}
										className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
										title="Save details"
									>
										<SaveIcon className="w-4 h-4" />
									</button>
									<button onClick={handleCancel} className="p-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors" title="Cancel">
										<CancelIcon className="w-4 h-4" />
									</button>
								</div>
							) : (
								<button onClick={() => startEdit('details')} className="p-2 text-gray-600 hover:text-gray-800 transition-colors" title="Edit details">
									<EditIcon className="w-4 h-4" />
								</button>
							)}
						</div>

						{editMode === 'details' ? (
							<RecipeForm formData={recipeForm} onChange={setRecipeForm} options={options} collections={collections} />
						) : (
							<RecipeView recipe={recipe} />
						)}
					</div>

					{/* Delete Recipe Button */}
					<div className="flex justify-end">
						<button
							onClick={() => setShowDeleteConfirm(true)}
							className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2"
						>
							<TrashIcon className="w-4 h-4" />
							Delete Recipe
						</button>
					</div>
				</div>
			</div>

			{/* Ingredients Section - Full Width */}
			<div className="mt-8">
				<div className="bg-white border border-custom rounded-sm shadow-md p-4">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-xl font-semibold">Ingredients</h2>
						{editMode === 'ingredients' ? (
							<div className="flex gap-2">
								<button
									onClick={handleSaveIngredients}
									disabled={isLoading}
									className="p-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
									title="Save ingredients"
								>
									<SaveIcon className="w-4 h-4" />
								</button>
								<button onClick={handleCancel} className="p-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors" title="Cancel">
									<CancelIcon className="w-4 h-4" />
								</button>
							</div>
						) : (
							<button
								onClick={() => startEdit('ingredients')}
								className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
								title="Edit ingredients"
							>
								<EditIcon className="w-4 h-4" />
							</button>
						)}
					</div>

					<IngredientsTable
						ingredients={ingredients}
						isEditing={editMode === 'ingredients'}
						options={options}
						newIngredients={newIngredients}
						onNewIngredientsChange={setNewIngredients}
						onDeleteIngredient={handleDeleteIngredient}
						onAddIngredient={handleAddIngredient}
						onRemoveNewIngredient={handleRemoveNewIngredient}
						onAddNewIngredientRow={handleAddNewIngredientRow}
					/>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<ConfirmDialog
				isOpen={showDeleteConfirm}
				onCancel={() => setShowDeleteConfirm(false)}
				onConfirm={handleDeleteRecipe}
				title="Delete Recipe"
				message={`Are you sure you want to delete "${recipe.name}"? This action cannot be undone.`}
				confirmText="Delete"
			/>
		</div>
	);
};

export default RecipeEditorNew;
