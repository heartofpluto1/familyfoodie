'use client';

import { useFileUpload } from '../hooks/useFileUpload';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

interface ImageUploadProps {
	currentImageSrc?: string;
	onImageUploaded?: () => void;
	recipeId?: number;
	isEditing?: boolean;
}

const ImageUpload = ({ currentImageSrc, onImageUploaded, recipeId, isEditing = false }: ImageUploadProps) => {
	const imageUpload = useFileUpload({
		allowedTypes: ['image/jpeg', 'image/jpg', 'image/png'],
		maxSize: 5 * 1024 * 1024, // 5MB
		uploadEndpoint: '/api/recipe/upload-image',
	});

	const dragAndDrop = useDragAndDrop(imageUpload.validateAndSetFile);

	const handleImageUpload = async () => {
		if (recipeId && imageUpload.selectedFile) {
			const success = await imageUpload.uploadFile(recipeId, 'image');
			if (success && onImageUploaded) {
				onImageUploaded();
			}
		}
	};

	const displayImageSrc = imageUpload.previewUrl || currentImageSrc;

	return (
		<div className="relative">
			{displayImageSrc ? (
				<img src={displayImageSrc} alt="Recipe" className="w-full object-cover" />
			) : (
				<div className="w-full h-48 bg-gray-200 flex items-center justify-center">
					<div className="text-gray-400">
						<div className="text-4xl mb-2">🍽️</div>
						<div className="text-sm">No image yet</div>
					</div>
				</div>
			)}
			{isEditing && (
				<div
					className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
						dragAndDrop.isDragOver
							? 'bg-blue-500/80 backdrop-blur-sm'
							: imageUpload.selectedFile
								? 'bg-black/60 backdrop-blur-sm'
								: 'bg-black/40 backdrop-blur-sm'
					}`}
					onDragOver={dragAndDrop.handleDragOver}
					onDragLeave={dragAndDrop.handleDragLeave}
					onDrop={dragAndDrop.handleDrop}
				>
					<div className="text-center text-white p-6">
						{dragAndDrop.isDragOver ? (
							<div>
								<div className="text-2xl mb-2">📁</div>
								<div className="text-lg font-medium">Drop image here</div>
							</div>
						) : imageUpload.selectedFile ? (
							<div className="space-y-3">
								<div className="text-lg font-medium">{recipeId ? 'New image selected' : 'Image selected'}</div>
								<div className="text-sm opacity-90">{imageUpload.selectedFile.name}</div>
								<div className="flex gap-2 justify-center">
									{recipeId && (
										<button
											type="button"
											onClick={handleImageUpload}
											disabled={imageUpload.isUploading}
											className="px-4 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors disabled:opacity-50"
										>
											{imageUpload.isUploading ? 'Uploading...' : 'Upload'}
										</button>
									)}
									<button
										type="button"
										onClick={imageUpload.clearFile}
										disabled={imageUpload.isUploading}
										className="btn-default px-4 py-2 rounded-sm disabled:opacity-50"
									>
										{recipeId ? 'Cancel' : 'Remove'}
									</button>
								</div>
							</div>
						) : (
							<div>
								<div className="text-2xl mb-2">📷</div>
								<div className="text-lg font-medium mb-2">{recipeId ? 'Change Recipe Image' : 'Add Recipe Image'}</div>
								<div className="text-sm opacity-90 mb-3">Drag & drop or click to select</div>
								<input
									type="file"
									accept="image/jpeg,image/jpg,image/png"
									onChange={imageUpload.handleFileSelect}
									className="hidden"
									id="recipe-image-input"
								/>
								<label
									htmlFor="recipe-image-input"
									className="px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors cursor-pointer inline-block"
								>
									Select Image
								</label>
								<div className="text-xs opacity-75 mt-2">JPEG, JPG, PNG (max 5MB)</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

// Export the hook for cases where we need the file data
export { useFileUpload as useImageUpload };
export default ImageUpload;
