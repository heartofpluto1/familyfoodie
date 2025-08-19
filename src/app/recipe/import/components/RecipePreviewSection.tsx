'use client';

import { RefreshIcon, DownloadIcon } from '@/app/components/Icons';
import RecipeForm from '@/app/recipe/components/RecipeForm';
import IngredientsPreviewTable from './IngredientsPreviewTable';
import HeroImageCropper from './HeroImageCropper';
import { RecipeDetail, RecipeIngredient } from '@/types/menus';
import { RecipeFormData } from '@/app/recipe/types';
import { RecipeOptions } from '../utils/recipeUtils';
import { ImportedRecipe, Category, PreviewResponse } from '../types/importTypes';

interface RecipePreviewSectionProps {
	recipeDetail: RecipeDetail;
	recipeForm: RecipeFormData;
	ingredients: RecipeIngredient[];
	options: RecipeOptions | null;
	isProcessing: boolean;
	processingStep: string;
	rawApiResponse?: PreviewResponse | null; // Add raw API response for debugging
	heroImage?: string | null; // Add hero image
	heroImageCrop?: { x: number; y: number; width: number; height: number } | null; // Add crop coordinates
	pdfImages?: string[]; // Add PDF images from AI processing
	recipe?: ImportedRecipe | null; // Add recipe for image location
	categories?: { pantryCategories: Category[]; supermarketCategories: Category[] } | null; // Add ingredient categories
	seasonReason?: string | null; // Add AI's reason for season choice
	onRecipeFormChange: (formData: RecipeFormData) => void;
	onIngredientsChange: (ingredients: RecipeIngredient[]) => void;
	onConfirmImport: () => void;
	onCancel: () => void;
	onHeroImageCropChange?: (croppedImageDataUrl: string, cropCoordinates: { x: number; y: number; width: number; height: number }) => void;
}

const RecipePreviewSection = ({
	recipeForm,
	ingredients,
	options,
	isProcessing,
	processingStep,
	heroImage,
	heroImageCrop,
	pdfImages,
	recipe,
	categories,
	seasonReason,
	onRecipeFormChange,
	onIngredientsChange,
	onConfirmImport,
	onCancel,
	onHeroImageCropChange,
}: RecipePreviewSectionProps) => {
	return (
		<div>
			{/* Preview Notice */}
			<div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm">
				<p className="text-sm text-yellow-800 dark:text-yellow-200">
					<strong>Preview & Edit Mode:</strong> Review and edit the extracted recipe below. Click &quot;Confirm Import&quot; to save it to your collection.
				</p>
			</div>

			{/* Action Buttons */}
			<div className="mb-6 flex gap-2">
				<button
					onClick={onConfirmImport}
					disabled={isProcessing}
					className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isProcessing ? (
						<>
							<RefreshIcon className="w-5 h-5 animate-spin" />
							{processingStep || 'Importing...'}
						</>
					) : (
						<>
							<DownloadIcon className="w-5 h-5" />
							Confirm Import
						</>
					)}
				</button>
				<button
					onClick={onCancel}
					disabled={isProcessing}
					className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Cancel & Try Another
				</button>
			</div>

			{/* Recipe Details */}
			<div className="bg-white border border-custom rounded-sm shadow-md overflow-hidden mb-8">
				{/* Hero Image Cropping Interface - replaces static hero image */}
				{heroImage &&
				pdfImages &&
				recipe?.hasHeroImage &&
				recipe?.imageLocation &&
				heroImageCrop &&
				onHeroImageCropChange &&
				pdfImages[recipe.imageLocation.pageIndex] ? (
					<HeroImageCropper
						pageImageDataUrl={pdfImages[recipe.imageLocation.pageIndex]}
						initialCrop={heroImageCrop}
						onCropChange={onHeroImageCropChange}
					/>
				) : null}

				<div className="p-6 space-y-4">
					<RecipeForm formData={recipeForm} onChange={onRecipeFormChange} options={options} isNewRecipe={true} seasonReason={seasonReason} />
				</div>
			</div>

			{/* Ingredients Table - Full Width */}
			<div className="space-y-6">
				<IngredientsPreviewTable ingredients={ingredients} onIngredientsChange={onIngredientsChange} options={options} categories={categories} />
			</div>
		</div>
	);
};

export default RecipePreviewSection;
