'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeDetail, RecipeIngredient } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import { SaveIcon, EditIcon, CancelIcon } from '@/app/components/Icons';
import { useToast } from '@/app/components/ToastProvider';
import Modal from '@/app/components/Modal';
import ImageUploadWithCrop from './ImageUploadWithCrop';
import PdfUpload from './PdfUpload';
import RecipeForm from '@/app/recipe/components/RecipeForm';
import RecipeView from './RecipeView';
import IngredientsTable from './IngredientsTable';
import { useRecipeOptions } from '@/app/recipe/hooks/useRecipeOptions';
import { useIngredientApi } from '../hooks/useIngredientApi';
import { RecipeFormData, NewIngredient } from '@/app/recipe/types';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';

interface RecipeEditorProps {
	recipe: RecipeDetail;
	collections?: Collection[];
}

type EditMode = 'none' | 'details' | 'ingredients';

const RecipeEditor = ({ recipe, collections }: RecipeEditorProps) => {
	const router = useRouter();
	const { showToast } = useToast();
	const { options } = useRecipeOptions();
	const ingredientApi = useIngredientApi();

	// Separate edit modes
	const [editMode, setEditMode] = useState<EditMode>('none');
	const [isLoading, setIsLoading] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [showPdfModal, setShowPdfModal] = useState(false);
	const [showImageModal, setShowImageModal] = useState(false);

	// Form data
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

	// Ingredients
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
				// Refresh page to show updated data
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
				id: ing.id > 0 ? ing.id : undefined,
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
				// Refresh page to show updated data
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
		setShowImageModal(false);
		// Force refresh to show new image
		setRefreshKey(prev => prev + 1);
		// Also refresh the page after a short delay
		setTimeout(() => {
			window.location.reload();
		}, 500);
	};

	const handleDeleteIngredient = async (id: number) => {
		// For ingredients being edited, track for deletion
		if (editMode === 'ingredients') {
			setIngredients(prev => prev.filter(ing => ing.id !== id));
			if (id > 0) {
				setDeletedIngredientIds(prev => [...prev, id]);
			}
		} else {
			// Original behavior for immediate deletion
			ingredientApi.deleteIngredientClick(id);
		}
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

		if (editMode === 'ingredients') {
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
				preperation: selectedPreparation ? { name: selectedPreparation.name } : undefined,
			};

			setIngredients(prev => [...prev, newRecipeIngredient]);
		} else {
			// Original behavior - add to database immediately
			const newId = await ingredientApi.addIngredient({
				recipeId: recipe.id,
				ingredientId: selectedIngredient.id,
				quantity: newIngredient.quantity,
				quantity4: newIngredient.quantity4,
				measureId: selectedMeasure?.id,
				preparationId: selectedPreparation?.id,
			});

			if (newId) {
				const newIngredientRecord: RecipeIngredient = {
					id: newId,
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
					preperation: selectedPreparation ? { name: selectedPreparation.name } : undefined,
					measure: selectedMeasure ? { id: selectedMeasure.id, name: selectedMeasure.name } : undefined,
				};
				setIngredients(prev => [...prev, newIngredientRecord]);
			}
		}

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
		if (newIngredients.length > 1) {
			const updated = newIngredients.filter((_, i) => i !== index);
			setNewIngredients(updated);
		}
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

	const handlePdfUploadComplete = () => {
		showToast('success', 'Success', 'Recipe PDF updated successfully');
		setShowPdfModal(false);
		// Refresh page to show changes
		setTimeout(() => {
			window.location.reload();
		}, 500);
	};

	return (
		<div className="relative">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mx-auto">
				{/* Left Column - Images and Recipe Details */}
				<div className="bg-white rounded-sm shadow space-y-4">
					{/* Recipe Image Section with contextual edit buttons */}
					<div className="relative">
						<img key={refreshKey} src={getRecipeImageUrl(recipe.filename, editMode !== 'none')} alt={recipe.name} className="w-full" />
						{/* Edit buttons */}
						<div className="absolute bottom-4 right-4 flex gap-2">
							{editMode === 'details' ? (
								<>
									{/* Save button */}
									<button
										onClick={handleSaveDetails}
										disabled={isLoading}
										className="w-10 h-10 bg-green-600 text-white rounded-full shadow-sm hover:bg-green-700 hover:shadow transition-colors disabled:opacity-50 flex items-center justify-center"
										title="Save"
									>
										<SaveIcon className="w-4 h-4" />
									</button>
									{/* Cancel button */}
									<button
										onClick={handleCancel}
										className="w-10 h-10 bg-gray-500 text-white rounded-full shadow-sm hover:bg-gray-600 hover:shadow transition-colors flex items-center justify-center"
										title="Cancel"
									>
										<CancelIcon className="w-4 h-4" />
									</button>
								</>
							) : (
								<>
									{/* Camera edit button */}
									<button
										onClick={() => setShowImageModal(true)}
										className="w-10 h-10 btn-default rounded-full shadow-sm hover:shadow flex items-center justify-center"
										title="Edit image"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
											/>
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
									</button>
									{/* Paper edit button */}
									<button
										onClick={() => setShowPdfModal(true)}
										className="w-10 h-10 btn-default rounded-full shadow-sm hover:shadow flex items-center justify-center"
										title="Edit PDF"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
									</button>
									{/* Recipe Details edit button */}
									<button
										onClick={() => startEdit('details')}
										className="w-10 h-10 btn-default rounded-full shadow-sm hover:shadow flex items-center justify-center"
										title="Edit details"
									>
										<EditIcon className="w-4 h-4" />
									</button>
								</>
							)}
						</div>
					</div>

					{/* Recipe Details Form */}
					<div className="px-4">
						{editMode === 'details' ? (
							<div className="pb-4">
								<RecipeForm formData={recipeForm} onChange={setRecipeForm} options={options} collections={collections} />
							</div>
						) : (
							<RecipeView recipe={recipe} />
						)}
					</div>
				</div>

				{/* Right Column - Ingredients with inline edit button */}
				<div>
					<div>
						<div className="pb-4 flex justify-between items-center">
							<h2 className="text-lg">Ingredients</h2>
							{editMode === 'ingredients' ? (
								<div className="flex gap-2">
									<button
										onClick={handleSaveIngredients}
										disabled={isLoading}
										className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors disabled:opacity-50"
										title="Save"
									>
										<SaveIcon className="w-4 h-4" />
									</button>
									<button
										onClick={handleCancel}
										className="p-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
										title="Cancel"
									>
										<CancelIcon className="w-4 h-4" />
									</button>
								</div>
							) : (
								<button onClick={() => startEdit('ingredients')} className="p-2 btn-default rounded-full hover:shadow" title="Edit ingredients">
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
			</div>

			{/* Image Upload Modal */}
			<Modal isOpen={showImageModal} onClose={() => setShowImageModal(false)} title="Recipe Image" maxWidth="xl">
				<ImageUploadWithCrop
					recipeId={recipe.id}
					currentImageSrc={recipe ? getRecipeImageUrl(recipe.filename, true) : undefined}
					onImageUploaded={handleImageUploadComplete}
					isEditing={true}
				/>
			</Modal>

			{/* PDF Upload Modal */}
			<Modal isOpen={showPdfModal} onClose={() => setShowPdfModal(false)} title="Recipe PDF" maxWidth="lg">
				<PdfUpload recipeId={recipe.id} onPdfUploaded={handlePdfUploadComplete} />
			</Modal>
		</div>
	);
};

export default RecipeEditor;
