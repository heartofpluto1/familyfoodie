'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/ToastProvider';
import { SaveIcon } from '@/app/components/Icons';
import ImageUploadSection from '../collection-add/components/ImageUploadSection';
import { getCollectionImageUrl, getCollectionDarkImageUrl } from '@/lib/utils/secureFilename';

interface CollectionFormData {
	title: string;
	subtitle: string;
	showOverlay: boolean;
}

interface Collection {
	id: number;
	title: string;
	subtitle: string | null;
	filename: string;
	filename_dark: string;
	show_overlay: boolean;
	url_slug: string;
}

interface CollectionFormProps {
	mode: 'create' | 'edit';
	collection?: Collection;
	onSuccess?: (collection: Collection) => void;
	onCancel?: () => void;
}

const CollectionForm: React.FC<CollectionFormProps> = ({ mode, collection, onSuccess, onCancel }) => {
	const router = useRouter();
	const { showToast } = useToast();
	const [isLoading, setIsLoading] = useState(false);

	// Form data - initialize with existing data in edit mode
	const [formData, setFormData] = useState<CollectionFormData>({
		title: collection?.title || '',
		subtitle: collection?.subtitle || '',
		showOverlay: collection?.show_overlay !== undefined ? collection.show_overlay : true,
	});

	// Image files for new uploads
	const [lightModeImage, setLightModeImage] = useState<File | null>(null);
	const [darkModeImage, setDarkModeImage] = useState<File | null>(null);

	// Image preview URLs
	const [lightImagePreview, setLightImagePreview] = useState<string | null>(null);
	const [darkImagePreview, setDarkImagePreview] = useState<string | null>(null);

	// Option to revert to default images (edit mode only)
	const [revertToDefault, setRevertToDefault] = useState(false);

	// Set initial preview URLs in edit mode
	useEffect(() => {
		if (mode === 'edit' && collection) {
			// Use existing images as previews if no new files selected
			if (!lightModeImage && !revertToDefault) {
				setLightImagePreview(getCollectionImageUrl(collection.filename));
			}
			if (!darkModeImage && !revertToDefault) {
				setDarkImagePreview(getCollectionDarkImageUrl(collection.filename_dark));
			}
		}
	}, [mode, collection]); // Remove file dependencies to only set on initial load

	// Cleanup blob URLs on unmount or when files change
	useEffect(() => {
		return () => {
			if (lightImagePreview?.startsWith('blob:')) {
				URL.revokeObjectURL(lightImagePreview);
			}
			if (darkImagePreview?.startsWith('blob:')) {
				URL.revokeObjectURL(darkImagePreview);
			}
		};
	}, [lightImagePreview, darkImagePreview]);

	const handleFieldChange = (field: keyof CollectionFormData, value: string | boolean) => {
		if (field === 'showOverlay') {
			setFormData(prev => ({ ...prev, [field]: value === 'true' || value === true }));
		} else {
			setFormData(prev => ({ ...prev, [field]: value as string }));
		}
	};

	const handleFileValidationError = (title: string, message: string) => {
		showToast('error', title, message);
	};

	const handleLightImageSelect = (file: File) => {
		setLightModeImage(file);
		const url = URL.createObjectURL(file);
		setLightImagePreview(url);
		setRevertToDefault(false);
	};

	const handleDarkImageSelect = (file: File) => {
		setDarkModeImage(file);
		const url = URL.createObjectURL(file);
		setDarkImagePreview(url);
		setRevertToDefault(false);
	};

	const handleRevertToDefault = () => {
		setRevertToDefault(true);
		setLightModeImage(null);
		setDarkModeImage(null);
		setLightImagePreview('/collections/custom_collection_004.jpg');
		setDarkImagePreview('/collections/custom_collection_004_dark.jpg');
	};

	const handleSubmit = async () => {
		// Validation
		if (!formData.title.trim()) {
			showToast('error', 'Validation Error', 'Collection title is required');
			return;
		}

		// In create mode, images are optional (API uses defaults)
		// In edit mode, we keep existing images unless new ones are provided

		setIsLoading(true);

		try {
			const uploadData = new FormData();

			if (mode === 'edit' && collection) {
				uploadData.append('collection_id', collection.id.toString());
			}

			uploadData.append('title', formData.title);
			uploadData.append('subtitle', formData.subtitle);
			uploadData.append('show_overlay', formData.showOverlay.toString());

			// Handle image uploads
			if (mode === 'edit' && revertToDefault) {
				uploadData.append('revert_to_default', 'true');
			} else {
				if (lightModeImage) {
					uploadData.append('light_image', lightModeImage);
				}
				if (darkModeImage) {
					uploadData.append('dark_image', darkModeImage);
				}
			}

			const endpoint = mode === 'create' ? '/api/collections/create' : '/api/collections/update';
			const method = mode === 'create' ? 'POST' : 'PUT';

			const response = await fetch(endpoint, {
				method,
				body: uploadData,
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || `Failed to ${mode} collection`);
			}

			showToast('success', 'Success', `Collection ${mode === 'create' ? 'created' : 'updated'} successfully`);

			if (onSuccess) {
				onSuccess(result.data);
			} else {
				// Default navigation
				if (mode === 'create') {
					router.push('/recipes');
				} else if (collection) {
					router.push(`/recipes/${collection.url_slug}`);
				}
			}
		} catch (error) {
			console.error(`Error ${mode}ing collection:`, error);
			showToast('error', 'Error', error instanceof Error ? error.message : `Failed to ${mode} collection`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		if (onCancel) {
			onCancel();
		} else {
			// Default navigation
			if (mode === 'create') {
				router.push('/recipes');
			} else if (collection) {
				router.push(`/recipes/${collection.url_slug}`);
			}
		}
	};

	// Determine current images for preview
	const currentLightImage =
		mode === 'edit' && collection && !lightModeImage && !revertToDefault
			? getCollectionImageUrl(collection.filename)
			: '/collections/custom_collection_004.jpg';

	const currentDarkImage =
		mode === 'edit' && collection && !darkModeImage && !revertToDefault
			? getCollectionDarkImageUrl(collection.filename_dark)
			: '/collections/custom_collection_004_dark.jpg';

	return (
		<div className="max-w-2xl mx-auto">
			<div className="bg-white border border-custom rounded-sm shadow-md overflow-hidden">
				<div className="p-6 space-y-6">
					{/* Collection Details */}
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Collection Title *</label>
							<input
								type="text"
								value={formData.title}
								onChange={e => handleFieldChange('title', e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
								placeholder="Enter collection title"
								disabled={isLoading}
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Collection Subtitle</label>
							<input
								type="text"
								value={formData.subtitle}
								onChange={e => handleFieldChange('subtitle', e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-blue-500"
								placeholder="Enter collection subtitle (optional)"
								disabled={isLoading}
							/>
						</div>
					</div>

					{/* Image Uploads */}
					<div className="space-y-3">
						{/* Help text */}
						<div className="text-sm text-muted">
							{mode === 'create' ? (
								<>
									<p>Don&apos;t have images handy? Use these defaults and change them later.</p>
									<p>
										You can edit and download them over at the{' '}
										<a
											href="https://www.canva.com/design/DAGxZ7Kn4CA/AH9vfwnm0BLwS9Z-KeQvHQ/view?utm_content=DAGxZ7Kn4CA&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink&mode=preview"
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-600 hover:text-blue-700 underline"
										>
											Canva template
										</a>
										.
									</p>
								</>
							) : (
								<>
									<p>Upload new images to replace the existing ones, or keep the current images.</p>
									{mode === 'edit' && collection && !collection.filename.startsWith('custom_collection_00') && (
										<button
											type="button"
											onClick={handleRevertToDefault}
											className="text-blue-600 hover:text-blue-700 underline text-sm mt-1"
											disabled={isLoading}
										>
											Revert to default images
										</button>
									)}
								</>
							)}
						</div>

						{/* Side by side upload sections */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<ImageUploadSection
								label={mode === 'create' ? 'Light Mode Image *' : 'Light Mode Image'}
								selectedFile={lightModeImage}
								onFileSelect={handleLightImageSelect}
								onFileValidationError={handleFileValidationError}
								disabled={isLoading}
								previewUrl={lightImagePreview}
								defaultBackgroundImage={currentLightImage}
								accept="image/jpeg,.jpg"
								showOverlay={formData.showOverlay}
								overlayImage="/collections/collection_overlay_light_mode.png"
								mode="light"
							/>

							<ImageUploadSection
								label={mode === 'create' ? 'Dark Mode Image *' : 'Dark Mode Image'}
								selectedFile={darkModeImage}
								onFileSelect={handleDarkImageSelect}
								onFileValidationError={handleFileValidationError}
								disabled={isLoading}
								previewUrl={darkImagePreview}
								defaultBackgroundImage={currentDarkImage}
								accept="image/jpeg,.jpg"
								showOverlay={formData.showOverlay}
								overlayImage="/collections/collection_overlay_dark_mode.png"
								mode="dark"
							/>
						</div>

						{/* Texture overlay checkbox */}
						<div className="flex items-center mt-4">
							<input
								type="checkbox"
								id="showOverlay"
								checked={formData.showOverlay}
								onChange={e => handleFieldChange('showOverlay', e.target.checked)}
								className="h-4 w-4 text-accent focus:ring-accent border-gray-300 rounded"
								disabled={isLoading}
							/>
							<label htmlFor="showOverlay" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
								Give it a 3D texture effect ✨
							</label>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-2 pt-4">
						<button
							onClick={handleSubmit}
							disabled={isLoading}
							className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<SaveIcon className="w-4 h-4" />
							{isLoading ? (mode === 'create' ? 'Creating...' : 'Updating...') : mode === 'create' ? 'Create Collection' : 'Update Collection'}
						</button>
						<button
							onClick={handleCancel}
							disabled={isLoading}
							className="btn-default px-4 py-2 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CollectionForm;
