'use client';

import HeaderPage from '@/app/components/HeaderPage';
import { useToast } from '@/app/components/ToastProvider';
import { useRecipeOptions } from '@/app/recipe/hooks/useRecipeOptions';
import { Collection } from '@/lib/queries/collections';
import PdfUploadSection from './components/PdfUploadSection';
import RecipePreviewSection from './components/RecipePreviewSection';
import { useAiImport } from './hooks/useAiImport';

interface AIRecipeImportClientProps {
	collections: Collection[];
}

const AIRecipeImportClient = ({ collections }: AIRecipeImportClientProps) => {
	const { showToast } = useToast();
	const { options } = useRecipeOptions();

	const {
		selectedFile,
		isProcessing,
		processingStep,
		showPreview,
		recipeDetail,
		recipeForm,
		ingredients,
		rawApiResponse,
		heroImage,
		heroImageCrop,
		pdfImages,
		recipe,
		categories,
		seasonReason,
		handleFileSelect,
		extractAndPreview,
		confirmImport,
		resetState,
		setRecipeForm,
		setIngredients,
		handleHeroImageCropChange,
	} = useAiImport(options, collections, showToast);

	const handleFileValidationError = (title: string, message: string) => {
		showToast('error', title, message);
	};

	return (
		<>
			<main className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<HeaderPage title="Import from PDF" subtitle="Upload a recipe PDF and let AI extract the recipe data automatically" />
				</div>

				<div className={showPreview ? 'w-full' : 'max-w-4xl mx-auto'}>
					{/* Upload Section */}
					{!showPreview && (
						<PdfUploadSection
							selectedFile={selectedFile}
							isProcessing={isProcessing}
							processingStep={processingStep}
							pdfImages={pdfImages}
							onFileSelect={handleFileSelect}
							onExtractAndPreview={extractAndPreview}
							onFileValidationError={handleFileValidationError}
						/>
					)}

					{/* Preview Section */}
					{showPreview && recipeDetail && (
						<RecipePreviewSection
							recipeDetail={recipeDetail}
							recipeForm={recipeForm}
							ingredients={ingredients}
							options={options}
							collections={collections}
							isProcessing={isProcessing}
							processingStep={processingStep}
							rawApiResponse={rawApiResponse}
							heroImage={heroImage}
							heroImageCrop={heroImageCrop}
							pdfImages={pdfImages}
							recipe={recipe}
							categories={categories}
							seasonReason={seasonReason}
							onRecipeFormChange={setRecipeForm}
							onIngredientsChange={setIngredients}
							onConfirmImport={confirmImport}
							onCancel={resetState}
							onHeroImageCropChange={handleHeroImageCropChange}
						/>
					)}

					{/* Error state when no recipe data */}
					{showPreview && !recipeDetail && (
						<div className="text-center py-8">
							<p className="text-gray-600 dark:text-gray-400">Unable to extract recipe data from this PDF.</p>
							<button onClick={resetState} className="btn-default mt-4 px-4 py-2 rounded-sm">
								Try Another PDF
							</button>
						</div>
					)}
				</div>
			</main>
		</>
	);
};

export default AIRecipeImportClient;
