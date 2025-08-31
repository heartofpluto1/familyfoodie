'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HeaderPage from '@/app/components/HeaderPage';
import { useToast } from '@/app/components/ToastProvider';
import { SaveIcon } from '@/app/components/Icons';
import ImageUploadSection from './components/ImageUploadSection';

interface CollectionFormData {
	title: string;
	subtitle: string;
	showOverlay: boolean;
}

const CollectionAddClient = () => {
	const router = useRouter();
	const { showToast } = useToast();
	const [isLoading, setIsLoading] = useState(false);

	// Form data
	const [formData, setFormData] = useState<CollectionFormData>({
		title: '',
		subtitle: '',
		showOverlay: true, // Default to true to maintain existing behavior
	});

	// Image files
	const [lightModeImage, setLightModeImage] = useState<File | null>(null);
	const [darkModeImage, setDarkModeImage] = useState<File | null>(null);

	// Image preview URLs
	const [lightImagePreview, setLightImagePreview] = useState<string | null>(null);
	const [darkImagePreview, setDarkImagePreview] = useState<string | null>(null);

	// Cleanup preview URLs on unmount
	useEffect(() => {
		return () => {
			if (lightImagePreview && lightImagePreview.startsWith('blob:')) {
				URL.revokeObjectURL(lightImagePreview);
			}
			if (darkImagePreview && darkImagePreview.startsWith('blob:')) {
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

	const handleSave = async () => {
		// Validation
		if (!formData.title.trim()) {
			showToast('error', 'Validation Error', 'Collection title is required');
			return;
		}

		// Images are optional - API will use defaults if not provided

		setIsLoading(true);

		try {
			// Create FormData for file upload
			const uploadData = new FormData();
			uploadData.append('title', formData.title);
			uploadData.append('subtitle', formData.subtitle);
			uploadData.append('showOverlay', formData.showOverlay.toString());

			// Add images if provided (API will use defaults if not provided)
			if (lightModeImage) {
				uploadData.append('lightImage', lightModeImage);
			}

			if (darkModeImage) {
				uploadData.append('darkImage', darkModeImage);
			}

			const response = await fetch('/api/collections/create', {
				method: 'POST',
				body: uploadData,
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to create collection');
			}

			showToast('success', 'Success', 'Collection created successfully');
			router.push('/recipes');
		} catch (error) {
			console.error('Error creating collection:', error);
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to create collection');
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		router.push('/recipes');
	};

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<div className="mb-4">
					<Link href="/recipes" className="text-muted hover:text-foreground text-sm">
						← Back to Collections
					</Link>
				</div>
				<HeaderPage title="Add New Collection" subtitle="Create a new recipe collection with light and dark mode images" />
			</div>

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

							<div className="flex items-center">
								<input
									type="checkbox"
									id="showOverlay"
									checked={formData.showOverlay}
									onChange={e => handleFieldChange('showOverlay', e.target.checked ? 'true' : 'false')}
									className="h-4 w-4 text-accent focus:ring-accent border-gray-300 rounded"
									disabled={isLoading}
								/>
								<label htmlFor="showOverlay" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
									Display texture overlay on collection card
								</label>
							</div>
						</div>

						{/* Image Uploads */}
						<div className="space-y-3">
							{/* Side by side upload sections */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<ImageUploadSection
									label="Light Mode Image (Optional)"
									selectedFile={lightModeImage}
									onFileSelect={file => {
										setLightModeImage(file);
										const url = URL.createObjectURL(file);
										setLightImagePreview(url);
									}}
									onFileValidationError={handleFileValidationError}
									disabled={isLoading}
									previewUrl={lightImagePreview}
									defaultBackgroundImage="/collections/custom_collection_004.jpg"
									accept="image/jpeg,.jpg"
								/>

								<ImageUploadSection
									label="Dark Mode Image (Optional)"
									selectedFile={darkModeImage}
									onFileSelect={file => {
										setDarkModeImage(file);
										const url = URL.createObjectURL(file);
										setDarkImagePreview(url);
									}}
									onFileValidationError={handleFileValidationError}
									disabled={isLoading}
									previewUrl={darkImagePreview}
									defaultBackgroundImage="/collections/custom_collection_004_dark.jpg"
									accept="image/jpeg,.jpg"
								/>
							</div>
							{!lightModeImage && !darkModeImage && (
								<p className="text-sm text-muted mt-2">
									Don&apos;t have images handy? Use these defaults and change them later. They are available as a{' '}
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
							)}
						</div>

						{/* Action Buttons */}
						<div className="flex gap-2 pt-4">
							<button
								onClick={handleSave}
								disabled={isLoading}
								className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<SaveIcon className="w-4 h-4" />
								{isLoading ? 'Creating...' : 'Create Collection'}
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
		</main>
	);
};

export default CollectionAddClient;
