'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

interface ImageUploadWithCropProps {
	currentImageSrc?: string;
	onImageUploaded?: () => void;
	recipeId?: number;
	isEditing?: boolean;
}

const ImageUploadWithCrop = ({ currentImageSrc, onImageUploaded, recipeId, isEditing = false }: ImageUploadWithCropProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cropCanvasRef = useRef<HTMLCanvasElement>(null);
	const [showCropper, setShowCropper] = useState(false);
	const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
	const [croppedImageDataUrl, setCroppedImageDataUrl] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragMode, setDragMode] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'create' | null>(null);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [initialCropRect, setInitialCropRect] = useState({ x: 0, y: 0, width: 300, height: 220 });
	const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 300, height: 220 });
	const [scale, setScale] = useState(1);

	const imageUpload = useFileUpload({
		allowedTypes: ['image/jpeg', 'image/jpg', 'image/png'],
		maxSize: 5 * 1024 * 1024, // 5MB
		uploadEndpoint: '/api/recipe/upload-image',
	});

	const dragAndDrop = useDragAndDrop(imageUpload.validateAndSetFile);

	// Handle file selection and show cropper
	useEffect(() => {
		if (imageUpload.selectedFile) {
			const img = new Image();
			img.onload = () => {
				// Calculate scale for display (fit to container)
				const containerWidth = 600;
				const displayScale = Math.min(containerWidth / img.width, 1);
				setScale(displayScale);

				// Set initial crop to center with 3:2.2 aspect ratio
				const aspectRatio = 3 / 2.2;
				const cropWidth = Math.min(img.width * 0.8, 400);
				const cropHeight = cropWidth / aspectRatio;
				const cropX = (img.width - cropWidth) / 2;
				const cropY = (img.height - cropHeight) / 2;

				const initialCrop = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
				setInitialCropRect(initialCrop);
				setCropRect(initialCrop);
				setOriginalImage(img);
				setShowCropper(true);
			};
			img.src = imageUpload.previewUrl!;
		} else {
			setShowCropper(false);
			setOriginalImage(null);
			setCroppedImageDataUrl(null);
		}
	}, [imageUpload.selectedFile, imageUpload.previewUrl]);

	// Draw image to canvas when both image and canvas are ready
	useEffect(() => {
		if (!originalImage || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');
		if (!context) return;

		// Set canvas size to image size
		canvas.width = originalImage.width;
		canvas.height = originalImage.height;

		// Draw the image to canvas
		context.drawImage(originalImage, 0, 0);
	}, [originalImage]);

	const updateCropPreview = useCallback(() => {
		const cropCanvas = cropCanvasRef.current;
		const mainCanvas = canvasRef.current;
		if (!cropCanvas || !mainCanvas || !originalImage) return;

		const cropContext = cropCanvas.getContext('2d');
		if (!cropContext) return;

		// Set crop canvas size
		cropCanvas.width = cropRect.width;
		cropCanvas.height = cropRect.height;

		// Extract the cropped portion from the main canvas
		cropContext.drawImage(mainCanvas, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, cropRect.width, cropRect.height);

		// Convert to data URL
		const croppedDataUrl = cropCanvas.toDataURL('image/jpeg', 0.8);
		setCroppedImageDataUrl(croppedDataUrl);
	}, [cropRect, originalImage]);

	// Update crop preview whenever crop changes
	useEffect(() => {
		if (!originalImage || !cropCanvasRef.current) return;
		updateCropPreview();
	}, [cropRect, originalImage, updateCropPreview]);

	const handleDragStart = (e: React.MouseEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
		e.preventDefault();
		e.stopPropagation();

		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) / scale;
		const y = (e.clientY - rect.top) / scale;

		setIsDragging(true);
		setDragMode(mode);
		setDragStart({ x, y });
		setInitialCropRect(cropRect);
	};

	const handleCanvasMouseDown = (e: React.MouseEvent) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) / scale;
		const y = (e.clientY - rect.top) / scale;

		// Check if click is inside crop area
		if (x >= cropRect.x && x <= cropRect.x + cropRect.width && y >= cropRect.y && y <= cropRect.y + cropRect.height) {
			// Start moving existing crop
			handleDragStart(e, 'move');
		} else {
			// Start creating new crop
			setIsDragging(true);
			setDragMode('create');
			setDragStart({ x, y });
			setInitialCropRect({ x, y, width: 0, height: 0 });
		}
	};

	const handleMouseMove = useCallback(
		(e: MouseEvent | React.MouseEvent) => {
			if (!isDragging || !canvasRef.current || !dragMode) return;

			const canvas = canvasRef.current;
			const rect = canvas.getBoundingClientRect();
			const currentX = (e.clientX - rect.left) / scale;
			const currentY = (e.clientY - rect.top) / scale;

			const deltaX = currentX - dragStart.x;
			const deltaY = currentY - dragStart.y;

			let newRect = { ...initialCropRect };

			if (dragMode === 'move') {
				// Move the entire crop area
				newRect.x = Math.max(0, Math.min(canvas.width - newRect.width, initialCropRect.x + deltaX));
				newRect.y = Math.max(0, Math.min(canvas.height - newRect.height, initialCropRect.y + deltaY));
			} else if (dragMode === 'create') {
				// Create new crop area
				const newX = Math.min(dragStart.x, currentX);
				const newY = Math.min(dragStart.y, currentY);
				const newWidth = Math.abs(currentX - dragStart.x);
				const newHeight = Math.abs(currentY - dragStart.y);

				newRect = { x: newX, y: newY, width: newWidth, height: newHeight };
			} else {
				// Resize crop area based on corner
				switch (dragMode) {
					case 'nw':
						newRect.x = Math.min(currentX, initialCropRect.x + initialCropRect.width);
						newRect.y = Math.min(currentY, initialCropRect.y + initialCropRect.height);
						newRect.width = initialCropRect.x + initialCropRect.width - newRect.x;
						newRect.height = initialCropRect.y + initialCropRect.height - newRect.y;
						break;
					case 'ne':
						newRect.y = Math.min(currentY, initialCropRect.y + initialCropRect.height);
						newRect.width = Math.max(0, currentX - initialCropRect.x);
						newRect.height = initialCropRect.y + initialCropRect.height - newRect.y;
						break;
					case 'sw':
						newRect.x = Math.min(currentX, initialCropRect.x + initialCropRect.width);
						newRect.width = initialCropRect.x + initialCropRect.width - newRect.x;
						newRect.height = Math.max(0, currentY - initialCropRect.y);
						break;
					case 'se':
						newRect.width = Math.max(0, currentX - initialCropRect.x);
						newRect.height = Math.max(0, currentY - initialCropRect.y);
						break;
				}
			}

			// Constrain to canvas bounds
			newRect.x = Math.max(0, Math.min(newRect.x, canvas.width - newRect.width));
			newRect.y = Math.max(0, Math.min(newRect.y, canvas.height - newRect.height));
			newRect.width = Math.min(newRect.width, canvas.width - newRect.x);
			newRect.height = Math.min(newRect.height, canvas.height - newRect.y);

			// Enforce 3:2.2 aspect ratio
			const aspectRatio = 3 / 2.2;
			if (newRect.width / newRect.height > aspectRatio) {
				newRect.width = newRect.height * aspectRatio;
			} else {
				newRect.height = newRect.width / aspectRatio;
			}

			// Ensure minimum size
			const minSize = 50;
			if (newRect.width < minSize || newRect.height < minSize) {
				newRect.width = Math.max(minSize, minSize * aspectRatio);
				newRect.height = newRect.width / aspectRatio;
			}

			setCropRect(newRect);
		},
		[isDragging, dragMode, scale, dragStart, initialCropRect]
	);

	const handleMouseUp = () => {
		setIsDragging(false);
		setDragMode(null);
	};

	// Add global mouse event listeners when dragging
	useEffect(() => {
		if (!isDragging) return;

		const handleGlobalMouseMove = (e: MouseEvent) => {
			e.preventDefault();
			handleMouseMove(e);
		};

		const handleGlobalMouseUp = (e: MouseEvent) => {
			e.preventDefault();
			handleMouseUp();
		};

		document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
		document.addEventListener('mouseup', handleGlobalMouseUp, { passive: false });

		return () => {
			document.removeEventListener('mousemove', handleGlobalMouseMove);
			document.removeEventListener('mouseup', handleGlobalMouseUp);
		};
	}, [isDragging, handleMouseMove]);

	const handleImageUpload = async () => {
		if (recipeId && croppedImageDataUrl) {
			// Convert base64 to blob
			const response = await fetch(croppedImageDataUrl);
			const blob = await response.blob();

			// Create a File object from the blob
			const croppedFile = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });

			// Upload the cropped image
			const success = await imageUpload.uploadFileBlob(recipeId, croppedFile, 'image');
			if (success && onImageUploaded) {
				onImageUploaded();
			}
		}
	};

	const displayImageSrc = showCropper ? croppedImageDataUrl : currentImageSrc;

	if (showCropper && originalImage) {
		return (
			<div className="space-y-4">
				{/* Crop Interface */}
				<div className="relative inline-block overflow-hidden">
					<canvas
						ref={canvasRef}
						className="block cursor-crosshair"
						style={{
							maxWidth: '600px',
							width: originalImage ? `${originalImage.width * scale}px` : '600px',
							height: originalImage ? `${originalImage.height * scale}px` : '400px',
						}}
						onMouseDown={handleCanvasMouseDown}
					/>

					{/* Dark overlay for non-cropped areas - top */}
					<div
						className="absolute pointer-events-none"
						style={{
							left: 0,
							top: 0,
							width: '100%',
							height: `${cropRect.y * scale}px`,
							backgroundColor: 'rgba(0, 0, 0, 0.5)',
						}}
					/>

					{/* Dark overlay for non-cropped areas - bottom */}
					<div
						className="absolute pointer-events-none"
						style={{
							left: 0,
							top: `${(cropRect.y + cropRect.height) * scale}px`,
							width: '100%',
							height: `calc(100% - ${(cropRect.y + cropRect.height) * scale}px)`,
							backgroundColor: 'rgba(0, 0, 0, 0.5)',
						}}
					/>

					{/* Dark overlay for non-cropped areas - left */}
					<div
						className="absolute pointer-events-none"
						style={{
							left: 0,
							top: `${cropRect.y * scale}px`,
							width: `${cropRect.x * scale}px`,
							height: `${cropRect.height * scale}px`,
							backgroundColor: 'rgba(0, 0, 0, 0.5)',
						}}
					/>

					{/* Dark overlay for non-cropped areas - right */}
					<div
						className="absolute pointer-events-none"
						style={{
							left: `${(cropRect.x + cropRect.width) * scale}px`,
							top: `${cropRect.y * scale}px`,
							width: `calc(100% - ${(cropRect.x + cropRect.width) * scale}px)`,
							height: `${cropRect.height * scale}px`,
							backgroundColor: 'rgba(0, 0, 0, 0.5)',
						}}
					/>

					{/* Crop Overlay */}
					<div
						className="absolute border-2 border-dashed border-white pointer-events-none"
						style={{
							left: `${cropRect.x * scale}px`,
							top: `${cropRect.y * scale}px`,
							width: `${cropRect.width * scale}px`,
							height: `${cropRect.height * scale}px`,
						}}
					>
						{/* Drag handle in center */}
						<div
							className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-white bg-blue-500 bg-opacity-75 rounded-full cursor-move pointer-events-auto"
							onMouseDown={e => handleDragStart(e, 'move')}
						>
							<div className="flex items-center justify-center w-full h-full text-white text-xs">⊕</div>
						</div>

						{/* Resize handles */}
						<div
							className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-blue-500 cursor-nw-resize pointer-events-auto"
							onMouseDown={e => handleDragStart(e, 'nw')}
						/>
						<div
							className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-blue-500 cursor-ne-resize pointer-events-auto"
							onMouseDown={e => handleDragStart(e, 'ne')}
						/>
						<div
							className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-blue-500 cursor-sw-resize pointer-events-auto"
							onMouseDown={e => handleDragStart(e, 'sw')}
						/>
						<div
							className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-blue-500 cursor-se-resize pointer-events-auto"
							onMouseDown={e => handleDragStart(e, 'se')}
						/>

						{/* Dimensions label */}
						<div className="absolute -top-6 left-0 text-xs text-white bg-black bg-opacity-75 px-2 py-1 rounded pointer-events-none">
							{Math.round(cropRect.width)} × {Math.round(cropRect.height)}
						</div>
					</div>
				</div>

				{/* Hidden canvas for crop extraction */}
				<canvas ref={cropCanvasRef} style={{ display: 'none' }} />

				{/* Action Buttons */}
				<div className="flex gap-2">
					{recipeId && (
						<button
							type="button"
							onClick={handleImageUpload}
							disabled={imageUpload.isUploading}
							className="px-4 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors disabled:opacity-50"
						>
							{imageUpload.isUploading ? 'Uploading...' : 'Save Cropped Image'}
						</button>
					)}
					<button
						type="button"
						onClick={() => {
							imageUpload.clearFile();
							setShowCropper(false);
						}}
						disabled={imageUpload.isUploading}
						className="px-4 py-2 bg-gray-600 text-white rounded-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
				</div>

				<div className="text-sm text-gray-600 text-center">📸 Drag to adjust the crop area (maintains 3:2.2 aspect ratio)</div>
			</div>
		);
	}

	// Regular upload interface (no cropping)
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
						dragAndDrop.isDragOver ? 'bg-blue-500/80 backdrop-blur-sm' : 'bg-black/40 backdrop-blur-sm'
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

export default ImageUploadWithCrop;
