'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RecipeDetail, RecipeIngredient } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import { RecipeFormData } from '@/app/recipes/types';
import { ImportedRecipe, PreviewResponse, Category } from '../types/importTypes';
import { findMeasureByUnit, RecipeOptions } from '../utils/recipeUtils';
import { convertPdfToImages } from '../utils/pdfToImages';
import { extractHeroImageFromPdf } from '../utils/extractHeroImage';

type ToastType = 'error' | 'info' | 'success' | 'warning';

export const useAiImport = (options: RecipeOptions | null, collection: Collection, showToast: (type: ToastType, title: string, message: string) => void) => {
	const router = useRouter();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingStep, setProcessingStep] = useState<string>('');
	const [showPreview, setShowPreview] = useState(false);
	const [recipe, setRecipe] = useState<ImportedRecipe | null>(null);
	const [recipeDetail, setRecipeDetail] = useState<RecipeDetail | null>(null);
	const [rawApiResponse, setRawApiResponse] = useState<PreviewResponse | null>(null); // Store raw API response for debugging
	const [heroImage, setHeroImage] = useState<string | null>(null); // Store extracted hero image
	const [heroImageCrop, setHeroImageCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // Store crop coordinates
	const [croppedHeroImage, setCroppedHeroImage] = useState<string | null>(null); // Store cropped hero image data
	const [pdfImages, setPdfImages] = useState<string[]>([]); // Store the PDF images sent to AI
	const [categories, setCategories] = useState<{ pantryCategories: Category[]; supermarketCategories: Category[] } | null>(null); // Store ingredient categories
	const [seasonReason, setSeasonReason] = useState<string | null>(null); // Store AI's reason for season choice

	// Form data state for editing
	const [recipeForm, setRecipeForm] = useState<RecipeFormData>({
		name: '',
		description: '',
		prepTime: undefined,
		cookTime: undefined,
		seasonId: undefined,
		primaryTypeId: undefined,
		secondaryTypeId: undefined,
		shop_qty: 2,
		collectionId: collection.id,
	});
	const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

	const resetState = () => {
		setShowPreview(false);
		setRecipe(null);
		setRecipeDetail(null);
		setSelectedFile(null);
		setRawApiResponse(null);
		setHeroImage(null);
		setHeroImageCrop(null);
		setCroppedHeroImage(null);
		setPdfImages([]);
		setCategories(null);
		setSeasonReason(null);
		setRecipeForm({
			name: '',
			description: '',
			prepTime: undefined,
			cookTime: undefined,
			seasonId: undefined,
			primaryTypeId: undefined,
			secondaryTypeId: undefined,
			shop_qty: 2,
			collectionId: collection.id,
		});
		setIngredients([]);
	};

	const handleFileSelect = (file: File) => {
		setSelectedFile(file);
		setShowPreview(false);
		setRecipe(null);
		setRecipeDetail(null);
		setRawApiResponse(null);
		setHeroImage(null);
		setHeroImageCrop(null);
		setCroppedHeroImage(null);
		setPdfImages([]);
		setCategories(null);
		setSeasonReason(null);
	};

	const extractAndPreview = async () => {
		if (!selectedFile) {
			showToast('error', 'Error', 'Please select a file first');
			return;
		}

		setIsProcessing(true);

		try {
			let images: string[] = [];
			const isImage = selectedFile.type.startsWith('image/');

			if (isImage) {
				// For JPG/JPEG, read the file directly as base64
				setProcessingStep('Processing image');
				const reader = new FileReader();
				const imageDataUrl = await new Promise<string>((resolve, reject) => {
					reader.onload = e => resolve(e.target?.result as string);
					reader.onerror = reject;
					reader.readAsDataURL(selectedFile);
				});
				images = [imageDataUrl];
				setPdfImages(images);
				setProcessingStep('Sending image to AI for analysis');
			} else {
				// For PDF, convert to images first
				setProcessingStep('Converting PDF to images');
				images = await convertPdfToImages(selectedFile);
				setPdfImages(images);
				setProcessingStep(`Sending ${images.length} images to AI for analysis`);
			}

			// Send images to preview endpoint
			const formData = new FormData();
			images.forEach((imageDataUrl, index) => {
				// Convert base64 data URL to blob
				const base64Data = imageDataUrl.split(',')[1];
				const bytes = atob(base64Data);
				const arrayBuffer = new ArrayBuffer(bytes.length);
				const uint8Array = new Uint8Array(arrayBuffer);
				for (let i = 0; i < bytes.length; i++) {
					uint8Array[i] = bytes.charCodeAt(i);
				}
				const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
				formData.append(`image${index}`, blob, `page${index + 1}.jpg`);
			});

			const response = await fetch('/api/recipe/ai-preview', {
				method: 'POST',
				credentials: 'include',
				body: formData,
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to parse recipe');
			}

			const data = (await response.json()) as PreviewResponse;
			const importedRecipe = data.recipe;

			// Store raw API response for debugging and categories
			setRawApiResponse(data);
			setCategories(data.categories);
			setSeasonReason(importedRecipe.seasonReason || null);

			// Convert AI ingredients to RecipeIngredient format
			const convertedIngredients: RecipeIngredient[] = importedRecipe.ingredients.map((aiIngredient, index) => {
				const measure = findMeasureByUnit(aiIngredient.unit, options);

				// Determine pantry category - use provided category or find by name
				let pantryCategoryName = 'Other';
				let pantryCategoryId = aiIngredient.pantryCategory_id || 0;

				if (data.categories && aiIngredient.pantryCategory_id) {
					const category = data.categories.pantryCategories.find(c => c.id === aiIngredient.pantryCategory_id);
					if (category) {
						pantryCategoryName = category.name;
						pantryCategoryId = category.id;
					}
				}

				return {
					id: index + 1, // Temporary ID
					quantity: aiIngredient.quantity_2_servings,
					quantity4: aiIngredient.quantity_4_servings,
					ingredient: {
						id: aiIngredient.existing_ingredient_id || 0,
						name: aiIngredient.name,
						pantryCategory: {
							id: pantryCategoryId,
							name: pantryCategoryName,
						},
					},
					measure: measure
						? {
								id: measure.id,
								name: measure.name,
							}
						: undefined,
					// Store additional metadata for new ingredients
					existing_ingredient_id: aiIngredient.existing_ingredient_id,
					fresh: aiIngredient.fresh,
					pantryCategory_id: aiIngredient.pantryCategory_id,
					supermarketCategory_id: aiIngredient.supermarketCategory_id,
				} as RecipeIngredient & {
					existing_ingredient_id?: number;
					fresh?: boolean;
					pantryCategory_id?: number;
					supermarketCategory_id?: number;
				};
			});

			// Convert ImportedRecipe to RecipeDetail format
			const convertedRecipeDetail: RecipeDetail = {
				id: 0, // Temporary ID for preview
				name: importedRecipe.title,
				image_filename: 'preview.jpg', // Temporary filename
				pdf_filename: 'preview.pdf', // Temporary filename
				description: importedRecipe.description,
				prepTime: importedRecipe.prepTime,
				cookTime: importedRecipe.cookTime,
				seasonName: importedRecipe.cuisine,
				primaryTypeName: undefined,
				secondaryTypeName: undefined,
				collection_id: collection.id,
				collection_title: collection.title,
				url_slug: 'preview-recipe',
				collection_url_slug: 'default-collection',
				ingredients: convertedIngredients,
			};

			setRecipe(importedRecipe);
			setRecipeDetail(convertedRecipeDetail);

			// Find season ID from AI recommendation
			let seasonId: number | undefined = undefined;
			if (importedRecipe.season && options?.seasons) {
				const matchingSeason = options.seasons.find(season => season.name.toLowerCase() === importedRecipe.season?.toLowerCase());
				seasonId = matchingSeason?.id;
			}

			// Find primary type ID from AI recommendation
			let primaryTypeId: number | undefined = undefined;
			if (importedRecipe.primaryType && options?.primaryTypes) {
				const matchingPrimaryType = options.primaryTypes.find(type => type.name.toLowerCase() === importedRecipe.primaryType?.toLowerCase());
				primaryTypeId = matchingPrimaryType?.id;
			}

			// Find secondary type ID from AI recommendation
			let secondaryTypeId: number | undefined = undefined;
			if (importedRecipe.secondaryType && options?.secondaryTypes) {
				const matchingSecondaryType = options.secondaryTypes.find(type => type.name.toLowerCase() === importedRecipe.secondaryType?.toLowerCase());
				secondaryTypeId = matchingSecondaryType?.id;
			}

			// Initialize form data from the parsed recipe
			setRecipeForm({
				name: convertedRecipeDetail.name,
				description: convertedRecipeDetail.description,
				prepTime: convertedRecipeDetail.prepTime,
				cookTime: convertedRecipeDetail.cookTime,
				seasonId: seasonId,
				primaryTypeId: primaryTypeId,
				secondaryTypeId: secondaryTypeId,
				shop_qty: 2,
				collectionId: convertedRecipeDetail.collection_id,
			});
			setIngredients(convertedIngredients);

			// Extract hero image if available, or use first page as fallback
			const heroImageLocation = importedRecipe.imageLocation || {
				pageIndex: 0,
				x: 0,
				y: 0,
				width: 600,
				height: 400,
			};

			setProcessingStep('Extracting hero image');
			try {
				const heroImageDataUrl = await extractHeroImageFromPdf(selectedFile, heroImageLocation);
				if (heroImageDataUrl) {
					setHeroImage(heroImageDataUrl);
					setHeroImageCrop(heroImageLocation);
				} else {
					// If extraction failed, use the first page image directly as fallback
					if (images.length > 0) {
						setHeroImage(images[0]);
						setHeroImageCrop(heroImageLocation);
					}
				}
			} catch (error) {
				console.warn('Failed to extract hero image:', error);
				// Use the first page image directly as fallback
				if (images.length > 0) {
					setHeroImage(images[0]);
					setHeroImageCrop(heroImageLocation);
				}
			}

			setShowPreview(true);
			setProcessingStep('');
		} catch (error) {
			console.error('Error processing PDF:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to process PDF';
			showToast('error', 'Error', errorMessage);
		} finally {
			setIsProcessing(false);
			setProcessingStep('');
		}
	};

	const confirmImport = async () => {
		if (!selectedFile || !recipe) {
			showToast('error', 'Error', 'No preview data available');
			return;
		}

		if (!recipeForm.collectionId) {
			showToast('error', 'Error', 'Please select a collection for this recipe');
			return;
		}

		setIsProcessing(true);
		setProcessingStep('Importing recipe');

		try {
			// Create FormData with PDF and structured recipe data
			const formData = new FormData();
			formData.append('pdfFile', selectedFile);

			// Send the edited structured recipe data
			const structuredRecipeData = {
				title: recipeForm.name,
				description: recipeForm.description,
				prepTime: recipeForm.prepTime,
				cookTime: recipeForm.cookTime,
				servings: recipe.serves || 4,
				cuisine: recipeForm.seasonId ? options?.seasons.find(s => s.id === recipeForm.seasonId)?.name : recipe.cuisine,
				difficulty: recipe.difficulty || 'Medium',
				seasonId: recipeForm.seasonId,
				primaryTypeId: recipeForm.primaryTypeId,
				secondaryTypeId: recipeForm.secondaryTypeId,
				shop_qty: recipeForm.shop_qty || 2,
				collectionId: recipeForm.collectionId,
				ingredients: ingredients.map(ing => {
					const extendedIng = ing as RecipeIngredient & {
						existing_ingredient_id?: number;
						fresh?: boolean;
						pantryCategory_id?: number;
						supermarketCategory_id?: number;
					};
					return {
						name: ing.ingredient.name,
						quantity_2_servings: ing.quantity,
						quantity_4_servings: ing.quantity4,
						unit: ing.measure?.name || '',
						measureId: ing.measure?.id,
						existing_ingredient_id: extendedIng.existing_ingredient_id || (ing.ingredient.id > 0 ? ing.ingredient.id : undefined),
						fresh: extendedIng.fresh,
						pantryCategory_id: extendedIng.pantryCategory_id || ing.ingredient.pantryCategory?.id,
						supermarketCategory_id: extendedIng.supermarketCategory_id,
					};
				}),
			};
			formData.append('structuredRecipe', JSON.stringify(structuredRecipeData));

			// Add hero image crop coordinates if available
			if (heroImageCrop) {
				formData.append('heroImageCrop', JSON.stringify(heroImageCrop));
			}

			// Add cropped hero image if available
			if (croppedHeroImage) {
				// Convert base64 data URL to blob
				const base64Data = croppedHeroImage.split(',')[1];
				const bytes = atob(base64Data);
				const arrayBuffer = new ArrayBuffer(bytes.length);
				const uint8Array = new Uint8Array(arrayBuffer);
				for (let i = 0; i < bytes.length; i++) {
					uint8Array[i] = bytes.charCodeAt(i);
				}
				const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
				formData.append('heroImage', blob, 'hero.jpg');
			}

			// Send to server for actual import
			const response = await fetch('/api/recipe/ai-import', {
				method: 'POST',
				credentials: 'include',
				body: formData,
			});

			if (response.ok) {
				const data = await response.json();
				showToast('success', 'Success', data.message);

				// Navigate to the recipe using the new URL structure
				if (data.collectionSlug && data.recipeSlug) {
					router.push(`/recipes/${data.collectionSlug}/${data.recipeSlug}`);
				} else {
					// Fallback if collection info is not available
					showToast('warning', 'Navigation Issue', 'Recipe imported successfully but navigation may be incomplete.');
					router.push('/recipes');
				}
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || 'Failed to import recipe');
			}
		} catch (error) {
			console.error('Error importing recipe:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to import recipe';
			showToast('error', 'Error', errorMessage);
		} finally {
			setIsProcessing(false);
			setProcessingStep('');
		}
	};

	const handleHeroImageCropChange = (croppedImageDataUrl: string, cropCoordinates: { x: number; y: number; width: number; height: number }) => {
		setHeroImageCrop(cropCoordinates);
		setCroppedHeroImage(croppedImageDataUrl);
	};

	return {
		// State
		selectedFile,
		isProcessing,
		processingStep,
		showPreview,
		recipe,
		recipeDetail,
		recipeForm,
		ingredients,
		rawApiResponse,
		heroImage,
		heroImageCrop,
		pdfImages,
		categories,
		seasonReason,

		// Actions
		handleFileSelect,
		extractAndPreview,
		confirmImport,
		resetState,
		setRecipeForm,
		setIngredients,
		handleHeroImageCropChange,
	};
};
