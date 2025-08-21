'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeDetail, RecipeIngredient } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import { SaveIcon, EditIcon, TrashIcon } from '@/app/components/Icons';
import { useToast } from '@/app/components/ToastProvider';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import ImageUploadWithCrop from './ImageUploadWithCrop';
import PdfUpload from './PdfUpload';
import RecipeForm from '@/app/recipe/components/RecipeForm';
import RecipeView from './RecipeView';
import IngredientsTable from './IngredientsTable';
import { useRecipeOptions } from '@/app/recipe/hooks/useRecipeOptions';
import { useRecipeApi } from '../hooks/useRecipeApi';
import { useIngredientApi } from '../hooks/useIngredientApi';
import { RecipeFormData, NewIngredient } from '@/app/recipe/types';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';
import { FileUploadResponse } from '@/types/fileUpload';

interface RecipeEditorProps {
	recipe: RecipeDetail;
	collections?: Collection[];
	isEditing?: boolean;
	onStartEdit?: () => void;
	onSave?: (recipeId: number) => void;
	onCancel?: () => void;
}

const RecipeEditor = ({ recipe, collections, isEditing: externalIsEditing, onStartEdit, onSave, onCancel }: RecipeEditorProps) => {
	const router = useRouter();
	const { showToast } = useToast();
	const { options } = useRecipeOptions();
	const recipeApi = useRecipeApi();
	const ingredientApi = useIngredientApi();

	// Use external edit state if provided, otherwise manage internally
	const [internalIsEditing, setInternalIsEditing] = useState(false);
	const isEditing = externalIsEditing !== undefined ? externalIsEditing : internalIsEditing;
	const [isLoading, setIsLoading] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

	const handleSave = async () => {
		if (!recipeForm.name.trim() || !recipeForm.description.trim()) {
			showToast('error', 'Error', 'Recipe name and description are required');
			return;
		}

		setIsLoading(true);
		try {
			// Update existing recipe
			const success = await recipeApi.updateRecipe(recipe.id, recipeForm);
			if (success) {
				showToast('success', 'Success', 'Recipe updated successfully');
				if (onSave) {
					onSave(recipe.id);
				}
				if (externalIsEditing === undefined) {
					setInternalIsEditing(false);
				}
				// Refresh page to show updated data
				window.location.reload();
			}
		} catch (error) {
			console.error('Error saving recipe:', error);
			showToast('error', 'Error', 'Error updating recipe');
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteIngredient = async (id: number) => {
		ingredientApi.deleteIngredientClick(id);
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

		// Add to database immediately
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

		// Reset this specific row
		const updatedNewIngredients = [...newIngredients];
		updatedNewIngredients[index] = {
			ingredientName: '',
			quantity: '',
			quantity4: '',
			measureId: '',
			preparationId: '',
		};
		setNewIngredients(updatedNewIngredients);
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

	const handleImageUploadComplete = async (uploadResponse?: FileUploadResponse) => {
		showToast('success', 'Success', 'Image uploaded successfully');

		// Preload cache-busted image URL to warm the cache before page reload
		if (uploadResponse?.cacheBustedUrl) {
			const img = new Image();
			img.onload = () => {
				// Once cache-busted image is loaded, reload the page
				window.location.reload();
			};
			img.onerror = () => {
				// If preload fails, still reload the page
				window.location.reload();
			};
			img.src = uploadResponse.cacheBustedUrl;
		}
		window.location.reload();
	};

	const handlePdfUploadComplete = async (uploadResponse?: FileUploadResponse) => {
		showToast('success', 'Success', 'PDF uploaded successfully');

		// Preload cache-busted PDF URL to warm the cache before page reload
		if (uploadResponse?.cacheBustedUrl) {
			// For PDFs, we can't preload like images, so just fetch the URL to warm cache
			try {
				await fetch(uploadResponse.cacheBustedUrl, { method: 'HEAD' });
			} catch (error) {
				console.warn('Failed to preload PDF:', error);
			}
		}

		// Reload the page after preloading
		window.location.reload();
	};

	const handleDeleteRecipe = async () => {
		if (!recipe) return;

		setIsLoading(true);
		try {
			const success = await recipeApi.deleteRecipe(recipe.id);
			if (success) {
				router.push('/recipe'); // Navigate to recipe list
			}
		} catch (error) {
			console.error('Error deleting recipe:', error);
		} finally {
			setIsLoading(false);
			setShowDeleteConfirm(false);
		}
	};

	return (
		<>
			{/* Action Buttons for Edit Mode */}
			{
				<div className="mb-6 flex">
					{!isEditing ? (
						<button
							onClick={() => (externalIsEditing === undefined ? setInternalIsEditing(true) : onStartEdit?.())}
							className="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-sm hover:bg-accent/90 transition-colors"
						>
							<EditIcon className="w-4 h-4" />
							Edit Recipe
						</button>
					) : (
						<div className="flex items-center gap-2">
							<button
								onClick={handleSave}
								disabled={isLoading}
								className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors disabled:opacity-50"
							>
								<SaveIcon className="w-4 h-4" />
								{isLoading ? 'Saving...' : 'Save'}
							</button>
							<button
								onClick={() => {
									if (externalIsEditing === undefined) {
										setInternalIsEditing(false);
										// Reset form data
										setRecipeForm({
											name: recipe?.name || '',
											description: recipe?.description || '',
											prepTime: recipe?.prepTime,
											cookTime: recipe?.cookTime,
											seasonId: undefined,
											primaryTypeId: undefined,
											secondaryTypeId: undefined,
										});
										setIngredients(recipe?.ingredients || []);
									} else {
										onCancel?.();
									}
								}}
								disabled={isLoading}
								className="btn-default px-4 py-2 rounded-sm disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								onClick={() => setShowDeleteConfirm(true)}
								disabled={isLoading}
								className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50"
								title="Delete recipe"
							>
								<TrashIcon className="w-4 h-4" />
								Delete
							</button>
						</div>
					)}
				</div>
			}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
				{/* Left Column - Recipe Details */}
				<div className="bg-white border border-custom rounded-sm shadow-md overflow-hidden">
					{/* Recipe Image */}
					<ImageUploadWithCrop
						isEditing={isEditing}
						currentImageSrc={recipe ? getRecipeImageUrl(recipe.filename) : undefined}
						recipeId={recipe?.id}
						onImageUploaded={handleImageUploadComplete}
					/>

					<div className="p-6 space-y-4">
						{isEditing ? (
							<div className="space-y-4">
								<RecipeForm formData={recipeForm} onChange={setRecipeForm} options={options} collections={collections} isNewRecipe={false} />
								{recipe && <PdfUpload recipeId={recipe.id} onPdfUploaded={handlePdfUploadComplete} />}
							</div>
						) : (
							recipe && <RecipeView recipe={recipe} />
						)}
					</div>
				</div>

				{/* Right Column - Ingredients */}
				<div className="space-y-6">
					<IngredientsTable
						ingredients={ingredients}
						isEditing={isEditing}
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
				title="Delete Recipe"
				message={`Are you sure you want to delete "${recipe?.name}"? This will permanently delete the recipe, all its ingredients, and any associated files. This action cannot be undone.`}
				confirmText="Delete Recipe"
				cancelText="Cancel"
				onConfirm={handleDeleteRecipe}
				onCancel={() => setShowDeleteConfirm(false)}
				isLoading={isLoading}
			/>
		</>
	);
};

export default RecipeEditor;
