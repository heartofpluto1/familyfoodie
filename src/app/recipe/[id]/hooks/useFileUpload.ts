import { useState } from 'react';
import { useToast } from '@/app/components/ToastProvider';

interface UseFileUploadOptions {
	allowedTypes: string[];
	maxSize: number;
	uploadEndpoint: string;
}

export const useFileUpload = (options: UseFileUploadOptions) => {
	const { showToast } = useToast();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	const validateAndSetFile = (file: File): boolean => {
		// Validate file type
		if (!options.allowedTypes.includes(file.type)) {
			const fileTypes = options.allowedTypes.join(', ');
			showToast('error', 'Error', `Only ${fileTypes} files are allowed`);
			return false;
		}

		// Validate file size
		if (file.size > options.maxSize) {
			const sizeMB = Math.round(options.maxSize / (1024 * 1024));
			showToast('error', 'Error', `File size must be less than ${sizeMB}MB`);
			return false;
		}

		setSelectedFile(file);

		// Create preview URL for images
		if (file.type.startsWith('image/')) {
			const url = URL.createObjectURL(file);
			setPreviewUrl(url);
		}

		return true;
	};

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			validateAndSetFile(file);
		}
	};

	const uploadFile = async (recipeId: number, fileParamName: string): Promise<boolean> => {
		if (!selectedFile) return false;

		setIsUploading(true);
		try {
			const formData = new FormData();
			formData.append(fileParamName, selectedFile);
			formData.append('recipeId', recipeId.toString());

			const response = await fetch(options.uploadEndpoint, {
				method: 'POST',
				body: formData,
			});

			if (response.ok) {
				showToast('success', 'Success', `${fileParamName} uploaded successfully`);
				clearFile();
				return true;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || `Failed to upload ${fileParamName}`);
				return false;
			}
		} catch (error) {
			console.error(`Error uploading ${fileParamName}:`, error);
			showToast('error', 'Error', `Error uploading ${fileParamName}`);
			return false;
		} finally {
			setIsUploading(false);
		}
	};

	const uploadFileBlob = async (recipeId: number, file: File, fileParamName: string): Promise<boolean> => {
		setIsUploading(true);
		try {
			const formData = new FormData();
			formData.append(fileParamName, file);
			formData.append('recipeId', recipeId.toString());

			const response = await fetch(options.uploadEndpoint, {
				method: 'POST',
				body: formData,
			});

			if (response.ok) {
				showToast('success', 'Success', `${fileParamName} uploaded successfully`);
				clearFile();
				return true;
			} else {
				const error = await response.json();
				showToast('error', 'Error', error.error || `Failed to upload ${fileParamName}`);
				return false;
			}
		} catch (error) {
			console.error(`Error uploading ${fileParamName}:`, error);
			showToast('error', 'Error', `Error uploading ${fileParamName}`);
			return false;
		} finally {
			setIsUploading(false);
		}
	};

	const clearFile = () => {
		setSelectedFile(null);
		setPreviewUrl(null);
	};

	return {
		selectedFile,
		isUploading,
		previewUrl,
		validateAndSetFile,
		handleFileSelect,
		uploadFile,
		uploadFileBlob,
		clearFile,
	};
};
